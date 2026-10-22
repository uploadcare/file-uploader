import { describe, expect, it } from 'vitest';
import type { Config, UploadCtxProvider } from '@/index';
import { IMAGE } from '~/tests/fixtures/files';
import { recordEvents } from '~/tests/utils/event-recorder';
import { openModal, renderSolution } from '~/tests/utils/render-solution';
import '~/types/jsx';
import { bodiesOf, clearSent, types, waitForType } from './sink';

/** `qualityInsights` back on: the shared helper disables telemetry, which is the thing under test here. */
const renderWithTelemetry = () => renderSolution('regular', { qualityInsights: true });

/**
 * The end of a negative wait: a config change that does report, sent after everything already queued. The exact lists
 * below then claim nothing else was reported before it.
 */
const sendSentinel = async (config: Config) => {
  config.removeCopyright = !config.removeCopyright;
  await waitForType('change-config');
};

/** The upload's last public event: the debounced `change` that follows common-upload-success by the output flush. */
const uploadSettled = (provider: UploadCtxProvider) => {
  const recorder = recordEvents(provider);
  return () => recorder.waitForAfter('change', 'common-upload-success');
};

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
    expect(init.project_pubkey).toBe('demopublickey');
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
    const { api, config, provider } = await renderWithTelemetry();
    const settled = uploadSettled(provider);
    // Turned off after render on purpose: the subject is that a running session stops reporting.
    config.qualityInsights = false;
    clearSent();

    api.addFileFromObject(IMAGE.PIXEL);
    await settled();
    // Back on, the sentinel's change reports; nothing from while it was off may come before it.
    config.qualityInsights = true;
    await sendSentinel(config);

    expect(types()).toEqual(['change-config']);
  });
});

describe('telemetry: upload lifecycle', () => {
  it('reports the collection events and never the per-file ones', async () => {
    const { api, config, provider } = await renderWithTelemetry();
    const settled = uploadSettled(provider);
    await waitForType('init-solution');
    clearSent();

    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await settled();
    await sendSentinel(config);

    expect(types()).toEqual(['common-upload-start', 'file-url-changed', 'common-upload-success', 'change-config']);

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
    const { config, root } = await renderWithTelemetry();
    await waitForType('init-solution');
    clearSent();

    await openModal(root);
    // The dialog can be on screen before modal-open is reported, so the sentinel starts once it has been.
    await waitForType('modal-open');
    await sendSentinel(config);

    expect(types()).toEqual(['activity-change', 'modal-open', 'change-config']);
    // `activity` is stripped from the payload but kept as a top-level field.
    expect(bodiesOf('activity-change')[0].activity).toBe('start-from');
    expect(bodiesOf('activity-change')[0].payload.activity).toBeUndefined();
    expect(bodiesOf('modal-open')[0].payload.modal_id).toBe('start-from');
  });
});
