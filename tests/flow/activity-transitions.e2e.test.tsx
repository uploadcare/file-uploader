import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { UploadCtxProvider } from '@/index';
import { IMAGE } from '~/tests/fixtures/files';
import { recordEvents } from '~/tests/utils/event-recorder';
import {
  createInCtx,
  expectActivity,
  expectModal,
  renderSolution,
  type Solution,
  waitForBlocks,
  within,
} from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';

/**
 * Transitions between the built-in activities, asserted on what the user can actually see: the `active` attribute the
 * router puts on the activity host, and the `open` state of the `<dialog>` the modal drives. `getCurrentActivity()`
 * alone would pass while the DOM is broken, which is the failure this file exists to catch.
 *
 * Custom plugin activities are covered by tests/plugins/activity-registration.e2e.test.tsx; this is the built-ins.
 */

describe('regular: entering the flow', () => {
  it('opens start-from from nothing', async () => {
    const { root, api, provider } = await renderSolution('regular');
    const recorder = recordEvents(provider);

    api.initFlow();

    await expectActivity(root, 'start-from');
    await expectModal(root, 'start-from', 'open');
    // Not just state: the source list is rendered inside the dialog that is actually open.
    await expect
      .element(within(root).getByTestId('uc-start-from').getByRole('button', { name: 'From link', exact: true }))
      .toBeVisible();
    expect(api.getCurrentActivity()).toBe('start-from');
    expect(recorder.detailsOf('activity-change').at(-1)).toEqual({ activity: 'start-from' });
  });

  it('goes straight to the upload list when files are already in the collection', async () => {
    const { root, api } = await renderSolution('regular');
    api.addFileFromObject(IMAGE.PIXEL);
    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);

    api.initFlow();

    await expectActivity(root, 'upload-list');
    await expectModal(root, 'upload-list', 'open');
    await expectModal(root, 'start-from', 'closed');
    expect(api.getCurrentActivity()).toBe('upload-list');
  });
});

describe('regular: start-from to a source', () => {
  it('moves to the url source and swaps which modal is open', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');

    await within(root).getByTestId('uc-start-from').getByRole('button', { name: 'From link', exact: true }).click();

    await expectActivity(root, 'url');
    await expectModal(root, 'start-from', 'closed');
    expect(api.getCurrentActivity()).toBe('url');
  });

  it('moves to the camera source', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');

    await within(root).getByTestId('uc-start-from').getByRole('button', { name: 'Camera', exact: true }).click();

    await expectActivity(root, 'camera');
    expect(api.getCurrentActivity()).toBe('camera');
  });
});

describe('regular: leaving the flow', () => {
  it('closes everything on doneFlow', async () => {
    const { root, api, provider } = await renderSolution('regular');
    const recorder = recordEvents(provider);
    api.initFlow();
    await expectModal(root, 'start-from', 'open');

    api.doneFlow();

    await expectModal(root, 'start-from', 'closed');
    await vi.waitFor(() => expect(recorder.detailsOf('modal-close').length).toBeGreaterThan(0));

    expect(api.getCurrentActivity()).toBeNull();
  });

  it('closes everything on setModalState(false)', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');

    api.setModalState(false);

    await expectModal(root, 'start-from', 'closed');
    await expect.poll(() => api.getCurrentActivity()).toBe(null);
  });
});

describe('inline: no modal is ever used', () => {
  it('shows start-from inline without opening a dialog', async () => {
    const { root, api } = await renderSolution('inline');

    await expectActivity(root, 'start-from');
    expect(api.getCurrentActivity()).toBe('start-from');
    expect(within(root).getByTestId('uc-modal').query()).toBe(null);
  });

  it('switches to the upload list when a file arrives', async () => {
    const { root, api } = await renderSolution('inline');
    await expectActivity(root, 'start-from');

    api.addFileFromObject(IMAGE.PIXEL);

    await expectActivity(root, 'upload-list');
    expect(api.getCurrentActivity()).toBe('upload-list');
  });

  // Documented (api.mdx, setModalState): inline has no modal, so `setModalState(false)` does nothing but warn — it
  // used to null the activity, which inline turns into a reset to the start screen.
  it('leaves the inline uploader where it is and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { root, api } = await renderSolution('inline');
    api.addFileFromObject(IMAGE.PIXEL);
    await expectActivity(root, 'upload-list');

    api.setModalState(false);

    // The warning is the last thing setModalState(false) does, so the activity is final once it fires.
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[uc]/), expect.stringContaining('navigate()')),
    );
    expect(api.getCurrentActivity()).toBe('upload-list');
  });
});

describe('minimal: the upload list is the resting state', () => {
  it('starts on start-from and moves to the list once a file is added', async () => {
    const { root, api } = await renderSolution('minimal');

    api.addFileFromObject(IMAGE.PIXEL);

    await expectActivity(root, 'upload-list');
    expect(api.getCurrentActivity()).toBe('upload-list');
  });

  it('opens start-from in a modal on initFlow', async () => {
    const { root, api } = await renderSolution('minimal');

    api.initFlow();

    await expectModal(root, 'start-from', 'open');
    expect(api.getCurrentActivity()).toBe('start-from');
  });
});

/**
 * As in v1, inline and minimal report their start screen with `activity-change` when they mount. The listener is on
 * the provider before anything mounts, the way the docs attach it; the uploader joins the ctx first, as it does when
 * its tag is defined before the provider's.
 */
describe.each<Solution>(['inline', 'minimal'])('%s: activity-change for the start screen', (solution) => {
  const mount = async () => {
    const ctxName = getCtxName();
    const root = createInCtx<HTMLElement>(`uc-file-uploader-${solution}`, ctxName);
    const config = createInCtx('uc-config', ctxName, { pubkey: 'demopublickey', 'quality-insights': 'false' });
    const provider = createInCtx<UploadCtxProvider>('uc-upload-ctx-provider', ctxName);
    const recorder = recordEvents(provider);
    page.render(<div ctx-name={ctxName}></div>);
    const host = document.querySelector(`div[ctx-name="${ctxName}"]`)!;
    host.append(root, config);
    host.append(provider);
    await waitForBlocks(root, provider);
    return { api: provider.getAPI(), recorder };
  };

  it('fires it once the uploader mounts', async () => {
    const { api, recorder } = await mount();

    expect(api.getCurrentActivity()).toBe('start-from');
    // Every block has joined the ctx, so whatever mounting reports has been reported.
    expect(recorder.detailsOf('activity-change')).toEqual([{ activity: 'start-from' }]);
  });
});
