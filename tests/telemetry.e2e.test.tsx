import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Config, UploadCtxProvider } from '@/index.js';
import { delay } from '@/utils/delay';
import { IMAGE } from './fixtures/files';
import { cleanup, getCtxName } from './utils/test-renderer';
import '../types/jsx';

/**
 * Baseline for the telemetry contract: which requests the uploader sends to the telemetry endpoint, in which order,
 * and with which payloads. Nothing leaves the browser — `fetch` to the telemetry host is stubbed out.
 *
 * Note that `LitBlock.emit` mirrors every public event into telemetry, minus `TelemetryManager._excludedEvents`. The
 * exclusion list is asserted explicitly below, since silently starting to report per-file events would be a regression.
 */

const TELEMETRY_URL = 'https://tlm.uploadcare.com/api/v1/events';
/** Longer than the 300ms output flush, so trailing telemetry has been queued and sent. */
const SETTLE_MS = 1000;
const WAIT = { timeout: 20_000, interval: 50 };

/** Telemetry bodies are snake_cased on the way out. */
type TelemetryBody = {
  event_type: string;
  session_id: string;
  app_name: string;
  app_version: string;
  component: string | null;
  activity: string | null;
  project_pubkey: string;
  config?: Record<string, unknown>;
  payload: { location: string; metadata?: Record<string, unknown> & { event?: string }; [key: string]: unknown };
};

let sent: TelemetryBody[] = [];
let provider: UploadCtxProvider;
let config: Config;

const types = () => sent.map((body) => body.event_type);
const bodiesOf = (type: string) => sent.filter((body) => body.event_type === type);
const bodiesWithAction = (event: string) => sent.filter((body) => body.payload.metadata?.event === event);
const actionEvents = () => bodiesOf('action-event').map((body) => body.payload.metadata?.event);
const waitForType = (type: string) =>
  vi.waitFor(() => {
    const found = bodiesOf(type)[0];
    if (!found) throw new Error(`No telemetry "${type}". Sent: ${types().join(', ')}`);
    return found;
  }, WAIT);

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(async () => {
  sent = [];
  const originalFetch = window.fetch.bind(window);
  vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(TELEMETRY_URL)) {
      return originalFetch(input, init);
    }
    sent.push(JSON.parse(String(init?.body)) as TelemetryBody);
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });

  const ctxName = getCtxName();
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
  await delay(0);
  provider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
  config = page.getByTestId('uc-config').query()! as Config;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const api = () => provider.api;

describe('Telemetry: session', () => {
  it('sends init-solution first, carrying the effective config', async () => {
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
    await waitForType('init-solution');
    sent = [];

    config.multiple = false;
    await waitForType('change-config');

    expect(bodiesOf('change-config')[0].config).toMatchObject({ multiple: false });
  });

  it('sends nothing when qualityInsights is disabled', async () => {
    config.qualityInsights = false;
    sent = [];

    api().addFileFromObject(IMAGE.PIXEL);
    await delay(SETTLE_MS);

    expect(sent).toEqual([]);
  });
});

describe('Telemetry: upload lifecycle', () => {
  it('reports the collection events and never the per-file ones', async () => {
    await waitForType('init-solution');
    sent = [];

    api().addFileFromObject(IMAGE.PIXEL);
    api().uploadAll();
    await waitForType('common-upload-success');
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
    await waitForType('init-solution');
    sent = [];

    await page.getByText('Upload files', { exact: true }).click();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();
    await delay(SETTLE_MS);

    expect(types()).toEqual(['activity-change', 'modal-open']);
    // `activity` is stripped from the payload but kept as a top-level field.
    expect(bodiesOf('activity-change')[0].activity).toBe('start-from');
    expect(bodiesOf('activity-change')[0].payload.activity).toBeUndefined();
    expect(bodiesOf('modal-open')[0].payload.modal_id).toBe('start-from');
  });
});

describe('Telemetry: action events', () => {
  it('reports an action-event when a file is removed from the upload list', { timeout: 60_000 }, async () => {
    api().addFileFromObject(IMAGE.PIXEL);
    api().setCurrentActivity('upload-list');
    api().setModalState(true);
    await expect.element(page.getByTestId('uc-file-item')).toBeVisible();
    await waitForType('init-solution');
    sent = [];

    const fileItem = page.getByTestId('uc-file-item').query()!;
    fileItem.querySelector<HTMLButtonElement>('.uc-remove-btn')?.click();

    const removal = await vi.waitFor(() => {
      const found = bodiesWithAction('remove-file')[0];
      if (!found) throw new Error(`No "remove-file" telemetry. Sent: ${types().join(', ')}`);
      return found;
    }, WAIT);

    expect(removal.payload.metadata).toMatchObject({ event: 'remove-file', node: 'UC-FILE-ITEM' });
    expect(removal.event_type).toBe('action-event');
  });

  it('reports an action-event when the upload list is cleared', async () => {
    api().addFileFromObject(IMAGE.PIXEL);
    api().setCurrentActivity('upload-list');
    api().setModalState(true);
    await expect.element(page.getByTestId('uc-upload-list')).toBeVisible();
    await waitForType('init-solution');
    sent = [];

    const uploadList = page.getByTestId('uc-upload-list').query()!;
    uploadList.querySelector<HTMLButtonElement>('.uc-cancel-btn')?.click();
    await waitForType('action-event');

    expect(bodiesOf('action-event')[0].payload.metadata).toMatchObject({
      event: 'clear-all',
      node: 'UC-UPLOAD-LIST',
    });
  });
});

describe('Telemetry: errors', () => {
  it('reports an error-event when a file validator throws', async () => {
    config.fileValidators = [
      () => {
        throw new Error('validator exploded');
      },
    ];

    api().addFileFromObject(IMAGE.PIXEL);
    const error = await waitForType('error-event');

    expect(error.payload.metadata).toMatchObject({
      event: 'error',
      error: 'validator exploded',
    });
    expect(String((error.payload.metadata as Record<string, unknown>).text)).toContain('Error in file validator');
  });
});

describe('Telemetry: cloud image editor', () => {
  beforeEach(async () => {
    cleanup();
    sent = [];
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-cloud-image-editor uuid="f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f" ctx-name={ctxName}></uc-cloud-image-editor>
        <uc-config cdn-cname="https://ucarecdn.com/" ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );
    await delay(0);
  });

  it('reports the editor as its own solution', async () => {
    const init = await waitForType('init-solution');

    expect(init.component).toBe('uc-cloud-image-editor');
  });

  it('reports an action-event when a toolbar tab is clicked', async () => {
    await waitForType('init-solution');
    sent = [];

    await userEvent.click(page.getByRole('tab', { name: /tuning/i }));
    const action = await waitForType('action-event');

    expect(action.payload.metadata).toMatchObject({ tab_id: 'tuning', event: 'click' });
  });

  it('reports an action-event when a tuning operation is picked', async () => {
    await userEvent.click(page.getByRole('tab', { name: /tuning/i }));
    await waitForType('action-event');
    sent = [];

    await userEvent.click(page.getByRole('option', { name: /Brightness/i }));
    const action = await waitForType('action-event');

    expect(action.payload.metadata).toMatchObject({
      tab_id: 'tuning',
      operation: { filter: 'brightness', value: 0 },
    });
  });
});

describe('Telemetry: sources', () => {
  const WAIT = { timeout: 20_000, interval: 50 };

  /** Picks a source button out of the start-from list by its registered id. */
  const clickSource = async (sourceId: string) => {
    await page.getByText('Upload files', { exact: true }).click();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();
    const button = await vi.waitFor(() => {
      const found = document.querySelector<HTMLButtonElement>(`uc-source-btn[data-source-id="${sourceId}"] button`);
      if (!found) throw new Error(`Source button "${sourceId}" was not rendered`);
      return found;
    }, WAIT);
    button.click();
  };

  it('reports an action-event carrying the source id when a source is picked', async () => {
    await waitForType('init-solution');
    sent = [];

    await clickSource('dropbox');
    const action = await waitForType('action-event');

    // SourceBtn puts the id straight on the payload, not inside `metadata`.
    expect(action.payload.source_id).toBe('dropbox');
  });

  it('reports the camera action events in order', { timeout: 60_000 }, async () => {
    await clickSource('camera');
    const shot = page.getByTestId('uc-camera-source--shot');
    await expect.element(shot).toBeVisible();
    sent = [];

    await page.getByTestId('uc-camera-source--tab-video').click();
    await page.getByTestId('uc-camera-source--tab-photo').click();
    await shot.click();

    const accept = page.getByTestId('uc-camera-source--accept');
    await expect.element(accept).toBeVisible();
    const retake = document.querySelector<HTMLButtonElement>('uc-camera-source .uc-camera-actions .uc-secondary-btn')!;
    retake.click();

    await shot.click();
    await expect.element(accept).toBeVisible();
    await accept.click();

    await vi.waitFor(() => expect(actionEvents()).toContain('accept-camera'), WAIT);
    // One event per user action. On the video tab the same button reports `start-camera` / `stop-camera` instead.
    expect(actionEvents()).toEqual([
      'camera-tab-switch',
      'camera-tab-switch',
      'shot-camera',
      'retake-camera',
      'shot-camera',
      'accept-camera',
    ]);
    expect(bodiesWithAction('camera-tab-switch')[0].payload.metadata).toMatchObject({
      tab_id: 'video',
      node: 'UC-CAMERA-SOURCE',
    });
  });
});
