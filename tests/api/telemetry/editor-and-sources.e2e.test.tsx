import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { delay } from '@/utils/delay';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';
import { openModal, renderSolution, within } from '~/tests/utils/render-solution';
import { actionEvents, bodiesWithAction, clearSent, installTelemetryStub, waitForType } from './stub';

beforeEach(installTelemetryStub);

describe('telemetry: cloud image editor', () => {
  /** The standalone editor is not one of `renderSolution`'s solutions, so it is rendered by hand. */
  beforeEach(async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-cloud-image-editor uuid="f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f" ctx-name={ctxName}></uc-cloud-image-editor>
        <uc-config cdn-cname="https://ucarecdn.com/" ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );
    // One tick so the editor's blocks register with the ctx before a test drives them.
    await delay(0);
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

    // `operation` is read from `*operationTooltip`, which still holds the pre-click value — so it reports the stale
    // tooltip rather than the operation just picked. Pinned as current behaviour, not an endorsement of it.
    expect(action.payload.metadata).toMatchObject({
      tab_id: 'tuning',
      operation: { filter: 'filter', value: 0 },
    });
  });
});

describe('telemetry: sources', () => {
  const WAIT = { timeout: 20_000, interval: 50 };

  /** Picks a source button out of the start-from list by its registered id. */
  const clickSource = async (root: HTMLElement, sourceId: string) => {
    await openModal(root);
    const button = await vi.waitFor(() => {
      const found = root.querySelector<HTMLButtonElement>(`uc-source-btn[data-source-id="${sourceId}"] button`);
      if (!found) throw new Error(`Source button "${sourceId}" was not rendered`);
      return found;
    }, WAIT);
    button.click();
  };

  it('reports an action-event carrying the source id when a source is picked', async () => {
    // `qualityInsights` back on: the shared helper disables telemetry, which is the thing under test here.
    const { root } = await renderSolution('regular', { qualityInsights: true });
    await waitForType('init-solution');
    clearSent();

    await clickSource(root, 'dropbox');
    const action = await waitForType('action-event');

    // SourceBtn puts the id straight on the payload, not inside `metadata`.
    expect(action.payload.source_id).toBe('dropbox');
  });

  it('reports the camera action events in order', { timeout: 60_000 }, async () => {
    const { root } = await renderSolution('regular', { qualityInsights: true });
    await clickSource(root, 'camera');
    const shot = within(root).getByTestId('uc-camera-source--shot');
    await expect.element(shot).toBeVisible();
    clearSent();

    await within(root).getByTestId('uc-camera-source--tab-video').click();
    await within(root).getByTestId('uc-camera-source--tab-photo').click();
    await shot.click();

    const accept = within(root).getByTestId('uc-camera-source--accept');
    await expect.element(accept).toBeVisible();
    const retake = root.querySelector<HTMLButtonElement>('uc-camera-source .uc-camera-actions .uc-secondary-btn')!;
    retake.click();

    await shot.click();
    await expect.element(accept).toBeVisible();
    await accept.click();

    await vi.waitFor(() => expect(actionEvents()).toContain('accept-camera'), WAIT);
    // Every shot reports twice: `shot-camera` from the button handler, then `start-camera` from the shared camera
    // action dispatcher it calls.
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
});
