import { EDITOR_IMAGE_UUID } from '@uploadcare/api-emulator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { hasCtx } from '~/tests/utils/registry';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';
import { clickSource, inCtx, renderSolution, waitForBlocks, within } from '~/tests/utils/render-solution';
import { actionEvents, bodiesWithAction, clearSent, waitForType } from './sink';

describe('telemetry: cloud image editor', () => {
  /** The standalone editor is not one of `renderSolution`'s solutions, so it is rendered by hand. */
  beforeEach(async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-cloud-image-editor uuid={EDITOR_IMAGE_UUID} ctx-name={ctxName}></uc-cloud-image-editor>
        <uc-config cdn-cname="https://ucarecdn.com/" ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );
    await waitForBlocks(inCtx('uc-cloud-image-editor', ctxName), inCtx('uc-config', ctxName));
  });

  it('reports the editor as its own solution', async () => {
    const init = await waitForType('init-solution');

    expect(init.component).toBe('uc-cloud-image-editor');
  });

  it('reports an action-event when a toolbar tab is clicked', async () => {
    await waitForType('init-solution');
    clearSent();

    await userEvent.click(page.getByRole('tab', { name: /tuning/i }));
    const action = await waitForType('action-event');

    expect(action.payload.metadata).toMatchObject({ tab_id: 'tuning', event: 'click' });
  });

  it('reports an action-event when a tuning operation is picked', async () => {
    await userEvent.click(page.getByRole('tab', { name: /tuning/i }));
    await waitForType('action-event');
    clearSent();

    await userEvent.click(page.getByRole('option', { name: /Brightness/i }));
    const action = await waitForType('action-event');

    // The operation just picked, at its current value — not the tooltip the slider shows a render later.
    expect(action.payload.metadata).toMatchObject({
      tab_id: 'tuning',
      operation: { filter: 'brightness', value: 0 },
    });
  });

  it('reports the filter just picked, at its starting value', async () => {
    await userEvent.click(page.getByRole('tab', { name: /filters/i }));
    await waitForType('action-event');
    clearSent();

    await userEvent.click(page.getByRole('option', { name: /^Apply adaris filter$/i }));
    const action = await waitForType('action-event');

    expect(action.payload.metadata).toMatchObject({ operation: { filter: 'adaris', value: 100 } });
  });

  it.each(['apply', 'cancel'])('reports an action-event when %s is clicked', async (action) => {
    await waitForType('init-solution');
    clearSent();

    await userEvent.click(page.getByRole('button', { name: new RegExp(`^${action}$`, 'i') }));
    const sent = await waitForType('action-event');

    expect(sent.payload.metadata).toMatchObject({ action, event: 'click', node: 'UC-BTN-UI', tab_id: 'crop' });
  });
});

describe('telemetry: cloud image editor moved to a ctx that does not exist yet', () => {
  it('holds an action back until the new ctx is up, then reports it there', async () => {
    const ctxName = getCtxName();
    page.render(
      <div>
        <uc-cloud-image-editor uuid={EDITOR_IMAGE_UUID} ctx-name={ctxName}></uc-cloud-image-editor>
        <uc-config cdn-cname="https://ucarecdn.com/" ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </div>,
    );
    const editor = inCtx('uc-cloud-image-editor', ctxName);
    const config = inCtx('uc-config', ctxName);
    await waitForBlocks(editor, config);
    await waitForType('init-solution');
    await userEvent.click(page.getByRole('tab', { name: /tuning/i }));
    await waitForType('action-event');

    // Both leave, and the ctx is torn down with its telemetry manager.
    const parent = editor.parentElement as HTMLElement;
    editor.remove();
    config.remove();
    await expect.poll(() => hasCtx(ctxName)).toBe(false);
    clearSent();

    // The editor comes back first: its ctx, and so a telemetry manager, only exists again once the config does.
    parent.append(editor);
    await userEvent.click(page.getByRole('tab', { name: /crop/i }));
    parent.append(config);

    const action = await waitForType('action-event');
    expect(action.payload.metadata).toMatchObject({ tab_id: 'crop', event: 'click' });
  });
});

describe('telemetry: sources', () => {
  const WAIT = { timeout: 20_000, interval: 50 };

  it('reports an action-event carrying the source id when a source is picked', async () => {
    // `qualityInsights` back on: the shared helper disables telemetry, which is the thing under test here.
    const { root } = await renderSolution('regular', { qualityInsights: true });
    await waitForType('init-solution');
    clearSent();

    await clickSource(root, 'Dropbox');
    const action = await waitForType('action-event');

    expect(action.payload.metadata).toMatchObject({ event: 'select-source', source_id: 'dropbox' });
    // Also at the payload root, where telemetry consumers read it before it moved into `metadata`.
    expect(action.payload.source_id).toBe('dropbox');
  });

  it('reports the camera action events in order', { timeout: 60_000 }, async () => {
    const { root } = await renderSolution('regular', { qualityInsights: true });
    await clickSource(root, 'Camera');
    const shot = within(root).getByRole('button', { name: 'Shot', exact: true });
    await expect.element(shot).toBeVisible();
    clearSent();

    await within(root).getByRole('button', { name: 'Video', exact: true }).click();
    await within(root).getByRole('button', { name: 'Photo', exact: true }).click();
    await shot.click();

    const accept = within(root).getByRole('button', { name: 'Accept', exact: true });
    await expect.element(accept).toBeVisible();
    await within(root).getByTestId('uc-camera-source').getByRole('button', { name: 'Retake', exact: true }).click();

    await shot.click();
    await expect.element(accept).toBeVisible();
    await accept.click();

    await vi.waitFor(() => expect(actionEvents()).toContain('accept-camera'), WAIT);
    // One event per press, plus the `start-camera` every shot used to send too, kept for telemetry consumers.
    expect(actionEvents()).toEqual([
      'camera-tab-switch',
      'camera-tab-switch',
      'shot-camera',
      'start-camera',
      'retake-camera',
      'shot-camera',
      'start-camera',
      'accept-camera',
    ]);
    expect(bodiesWithAction('camera-tab-switch')[0].payload.metadata).toMatchObject({
      tab_id: 'video',
      node: 'UC-CAMERA-SOURCE',
    });
  });

  it('reports a recording as one event to start it and one to stop it', { timeout: 60_000 }, async () => {
    const { root } = await renderSolution('regular', { qualityInsights: true });
    await clickSource(root, 'Camera');
    const camera = within(root).getByTestId('uc-camera-source');
    await camera.getByRole('button', { name: 'Video', exact: true }).click();
    const shutter = camera.getByTestId('uc-camera-controls--shot');
    await expect.element(shutter).toHaveAccessibleName('Record Video');
    clearSent();

    await shutter.click();
    await expect.element(shutter).toHaveAccessibleName('Stop recording');
    await shutter.click();

    await vi.waitFor(() => expect(actionEvents()).toContain('stop-camera'), WAIT);
    // Tab switches are batched with these and can land after `clearSent()`; the test above orders them.
    expect(actionEvents().filter((event) => event !== 'camera-tab-switch')).toEqual([
      'shot-camera',
      'start-camera',
      'stop-camera',
    ]);
  });
});
