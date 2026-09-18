import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IMAGE } from '~/tests/fixtures/files';
import { renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';
import { bodiesOf, bodiesWithAction, clearSent, installTelemetryStub, types, waitForType } from './stub';

beforeEach(installTelemetryStub);

describe('telemetry: action events', () => {
  it('reports an action-event when a file is removed from the upload list', { timeout: 60_000 }, async () => {
    // `qualityInsights` back on: the shared helper disables telemetry, which is the thing under test here.
    const { api, root } = await renderSolution('regular', { qualityInsights: true });
    api.addFileFromObject(IMAGE.PIXEL);
    api.setCurrentActivity('upload-list');
    api.setModalState(true);
    const fileItem = within(root).getByTestId('uc-file-item');
    await expect.element(fileItem).toBeVisible();
    await waitForType('init-solution');
    clearSent();

    fileItem.query()!.querySelector<HTMLButtonElement>('.uc-remove-btn')?.click();

    const removal = await vi.waitFor(
      () => {
        const found = bodiesWithAction('remove-file')[0];
        if (!found) throw new Error(`No "remove-file" telemetry. Sent: ${types().join(', ')}`);
        return found;
      },
      { timeout: 20_000, interval: 50 },
    );

    expect(removal.payload.metadata).toMatchObject({ event: 'remove-file', node: 'UC-FILE-ITEM' });
    // FileItem sends this one without an eventType, so it goes out with an empty one. Pinned as current behaviour.
    expect(removal.event_type).toBe('');
  });

  it('reports an action-event when the upload list is cleared', async () => {
    const { api, root } = await renderSolution('regular', { qualityInsights: true });
    api.addFileFromObject(IMAGE.PIXEL);
    api.setCurrentActivity('upload-list');
    api.setModalState(true);
    const uploadList = within(root).getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();
    await waitForType('init-solution');
    clearSent();

    uploadList.query()!.querySelector<HTMLButtonElement>('.uc-cancel-btn')?.click();
    await waitForType('action-event');

    expect(bodiesOf('action-event')[0].payload.metadata).toMatchObject({
      event: 'clear-all',
      node: 'UC-UPLOAD-LIST',
    });
  });
});

describe('telemetry: errors', () => {
  it('reports an error-event when a file validator throws', async () => {
    const { api } = await renderSolution('regular', {
      qualityInsights: true,
      fileValidators: [
        () => {
          throw new Error('validator exploded');
        },
      ],
    });

    api.addFileFromObject(IMAGE.PIXEL);
    const error = await waitForType('error-event');

    expect(error.payload.metadata).toMatchObject({
      event: 'error',
      error: 'validator exploded',
    });
    expect(String((error.payload.metadata as Record<string, unknown>).text)).toContain('Error in file validator');
  });
});
