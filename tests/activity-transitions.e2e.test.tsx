import { beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { delay } from '@/utils/delay';
import { IMAGE } from './fixtures/files';
import { recordEvents } from './utils/event-recorder';
import { expectActivity, expectModal, renderSolution } from './utils/render-solution';
import '../types/jsx';

/**
 * Transitions between the built-in activities, asserted on what the user can actually see: the `active` attribute the
 * router puts on the activity host, and the `open` state of the `<dialog>` the modal drives. `getCurrentActivity()`
 * alone would pass while the DOM is broken, which is the failure this file exists to catch.
 *
 * Custom plugin activities are covered by tests/plugins/activity-registration.e2e.test.tsx; this is the built-ins.
 */

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('regular: entering the flow', () => {
  it('opens start-from from nothing', async () => {
    const { root, api, provider } = await renderSolution('regular');
    const recorder = recordEvents(provider);

    api.initFlow();

    await expectActivity(root, 'start-from');
    await expectModal(root, 'start-from', 'open');
    // Not just state: the source list is rendered inside the dialog that is actually open.
    await expect.element(page.getByTestId('uc-start-from').getByText('From link', { exact: true })).toBeVisible();
    expect(api.getCurrentActivity()).toBe('start-from');
    expect(recorder.detailsOf('activity-change').at(-1)).toEqual({ activity: 'start-from' });
  });

  it('goes straight to the upload list when files are already in the collection', async () => {
    const { root, api } = await renderSolution('regular');
    api.addFileFromObject(IMAGE.PIXEL);
    await delay(50);

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

    await page.getByTestId('uc-start-from').getByText('From link', { exact: true }).click();

    await expectActivity(root, 'url');
    await expectModal(root, 'start-from', 'closed');
    expect(api.getCurrentActivity()).toBe('url');
  });

  it('moves to the camera source', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');

    await page.getByTestId('uc-start-from').getByText('Camera', { exact: true }).click();

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

    // QUIRK(activity): `doneFlow` sets the activity to `doneActivity`, which is read from the `--cfg-done-activity`
    // CSS custom property and defaults to an empty string, not null (LitActivityBlock.ts:150 — `getCssData` returns
    // '' and `?? null` does not catch it). So after the documented "terminate the flow" call, `getCurrentActivity()`
    // is `''`, and a caller checking `=== null` sees a falsy value that is not null. Pinned, not endorsed.
    expect(api.getCurrentActivity()).toBe('');
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
    expect(root.querySelector('uc-modal')).toBe(null);
  });

  it('switches to the upload list when a file arrives', async () => {
    const { root, api } = await renderSolution('inline');
    await expectActivity(root, 'start-from');

    api.addFileFromObject(IMAGE.PIXEL);

    await expectActivity(root, 'upload-list');
    expect(api.getCurrentActivity()).toBe('upload-list');
  });

  // QUIRK(activity): inline treats `null` as "go back to the init activity" (FileUploaderInline.ts:82), so the
  // documented `setModalState(false)` — which sets the activity to null — cannot leave an inline uploader with
  // nothing showing. Pinned as current behaviour, not endorsed.
  it('re-enters the init activity instead of closing', async () => {
    const { root, api } = await renderSolution('inline');
    await expectActivity(root, 'start-from');

    api.setModalState(false);

    await delay(100);
    await expectActivity(root, 'start-from');
    expect(api.getCurrentActivity()).toBe('start-from');
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
