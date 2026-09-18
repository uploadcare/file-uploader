import { beforeEach, describe, expect, it } from 'vitest';
import { delay } from '@/utils/delay';
import { IMAGE } from '~/tests/fixtures/files';
import { openModal, renderSolution } from '~/tests/utils/render-solution';
import '~/types/jsx';
import { bodiesOf, clearSent, installTelemetryStub, SETTLE_MS, sent, types, waitForType } from './stub';

/** `qualityInsights` back on: the shared helper disables telemetry, which is the thing under test here. */
const renderWithTelemetry = () => renderSolution('regular', { qualityInsights: true });

beforeEach(installTelemetryStub);

describe('telemetry: session', () => {
  it('sends init-solution first, carrying the effective config', async () => {
    await renderWithTelemetry();
    const init = await waitForType('init-solution');

    expect(types()[0]).toBe('init-solution');
    expect(init.app_name).toBeTruthy();
    expect(init.app_version).toBeTruthy();
    expect(init.session_id).toBeTruthy();
    expect(init.app_name).toBe('blocks');
    expect(init.component).toBe('uc-file-uploader-regular');
    expect(init.payload.location).toBe(location.origin);
    expect(init.config).toMatchObject({ pubkey: 'demopublickey', test_mode: true, quality_insights: true });
    // The top-level pubkey is still empty at init time — the config has not reached TelemetryManager yet. Pinned as
    // current behaviour, not an endorsement of it.
    expect(init.project_pubkey).toBe('');
  });

  it('sends change-config when a config value changes after init', async () => {
    const { config } = await renderWithTelemetry();
    await waitForType('init-solution');
    clearSent();

    // Setting config after render is the subject: the change has to be observed post-init.
    config.multiple = false;
    await waitForType('change-config');

    expect(bodiesOf('change-config')[0].config).toMatchObject({ multiple: false });
  });

  it('sends nothing once qualityInsights is disabled', async () => {
    const { api, config } = await renderWithTelemetry();
    // Turned off after render on purpose: the subject is that a running session stops reporting.
    config.qualityInsights = false;
    clearSent();

    api.addFileFromObject(IMAGE.PIXEL);
    // Negative wait: nothing should be sent, so there is no signal to wait for.
    await delay(SETTLE_MS);

    expect(sent).toEqual([]);
  });
});

describe('telemetry: upload lifecycle', () => {
  it('reports the collection events and never the per-file ones', async () => {
    const { api } = await renderWithTelemetry();
    await waitForType('init-solution');
    clearSent();

    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await waitForType('common-upload-success');
    // Negative wait: the exact list below claims nothing else is reported.
    await delay(SETTLE_MS);

    // No `common-upload-start`: `uploadAll()` emits it straight through the EventEmitter, bypassing `LitBlock.emit`
    // and therefore telemetry.
    expect(types()).toEqual(['file-url-changed', 'common-upload-success']);

    // TelemetryManager._excludedEvents — reporting any of these would be a regression.
    for (const excluded of [
      'change',
      'common-upload-progress',
      'file-added',
      'file-removed',
      'file-upload-start',
      'file-upload-progress',
      'file-upload-success',
      'file-upload-failed',
    ]) {
      expect(bodiesOf(excluded)).toHaveLength(0);
    }
  });

  it('reports modal and activity events with the current activity attached', async () => {
    const { root } = await renderWithTelemetry();
    await waitForType('init-solution');
    clearSent();

    await openModal(root);
    // Negative wait: the exact list below claims nothing else is reported.
    await delay(SETTLE_MS);

    expect(types()).toEqual(['activity-change', 'modal-open']);
    // `activity` is stripped from the payload but kept as a top-level field.
    expect(bodiesOf('activity-change')[0].activity).toBe('start-from');
    expect(bodiesOf('activity-change')[0].payload.activity).toBeUndefined();
    expect(bodiesOf('modal-open')[0].payload.modal_id).toBe('start-from');
  });
});
