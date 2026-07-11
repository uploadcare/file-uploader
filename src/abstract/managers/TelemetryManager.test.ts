import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventType, InternalEventType } from '../../blocks/UploadCtxProvider/EventEmitter';
import type { ConfigType } from '../../types/index';
import { ConfigController } from '../controllers/ConfigController';
import { TelemetryManager } from './TelemetryManager';

const sendEventMock = vi.hoisted(() => vi.fn(async (_payload: Record<string, unknown>) => {}));

vi.mock('@uploadcare/quality-insights', () => ({
  TelemetryAPIService: class {
    public sendEvent = sendEventMock;
  },
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = ({
  solution,
  activity = null,
  router = true,
}: {
  solution?: string;
  activity?: string | null;
  router?: boolean;
} = {}) => {
  const config = new ConfigController();
  const manager = new TelemetryManager({
    config,
    getSolution: () => solution ?? null,
    // Mirrors the wiring closure: null until the router instance exists.
    getActivity: () => (router ? activity : null),
  });

  const setConfig = <K extends keyof ConfigType>(key: K, value: ConfigType[K]) => config.set(key, value);
  const enable = () => setConfig('qualityInsights', true);

  return { manager, setConfig, enable };
};

describe('TelemetryManager', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
    sendEventMock.mockClear();
  });

  it('sends nothing while qualityInsights is disabled', async () => {
    const { manager, setConfig } = setup();
    // Enabled by default (initialConfig.qualityInsights: true) — opt out.
    setConfig('qualityInsights', false);
    manager.sendEvent({ eventType: InternalEventType.INIT_SOLUTION });
    await flush();
    expect(sendEventMock).not.toHaveBeenCalled();
  });

  it('sends the init event with app/session/config metadata once enabled', async () => {
    const { manager, enable } = setup({ solution: 'UC-FILE-UPLOADER-REGULAR', activity: 'start-from' });
    enable();

    manager.sendEvent({ eventType: InternalEventType.INIT_SOLUTION });
    await flush();

    expect(sendEventMock).toHaveBeenCalledTimes(1);
    const payload = sendEventMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.eventType).toBe(InternalEventType.INIT_SOLUTION);
    expect(payload.component).toBe('uc-file-uploader-regular');
    expect(payload.activity).toBe('start-from');
    expect(payload.eventTimestamp).toBe(1_700_000_000_000);
    expect(payload.config).toBeDefined();
    expect((payload.payload as Record<string, unknown>).location).toBe(location.origin);
    expect(typeof payload.sessionId).toBe('string');
  });

  it('replaces customized sensitive config values with a redaction marker', async () => {
    const { manager, setConfig } = setup();
    setConfig('secureSignature', 'sig-secret');
    setConfig('metadata', { userId: 'private-data' });

    manager.sendEvent({ eventType: InternalEventType.INIT_SOLUTION });
    await flush();

    const payload = sendEventMock.mock.calls[0]?.[0] as { config: Record<string, unknown> };
    // Customized sensitive options stay visible as "used", value hidden.
    expect(payload.config.secureSignature).toBe('[redacted]');
    expect(payload.config.metadata).toBe('[redacted]');
    // Untouched sensitive options pass through as their (default) values.
    expect(payload.config.secureExpire).toBe('');
    expect(payload.config.secureDeliveryProxy).toBe('');
    // Non-sensitive keys are untouched.
    expect(payload.config.multiple).toBe(true);
    // The raw values never appear anywhere in the payload.
    const serialized = JSON.stringify(payload.config);
    expect(serialized).not.toContain('sig-secret');
    expect(serialized).not.toContain('private-data');
  });

  it('reports a null component when no solution is registered', async () => {
    const { manager, enable } = setup();
    enable();

    manager.sendEvent({ eventType: InternalEventType.INIT_SOLUTION });
    await flush();

    const payload = sendEventMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.component).toBeNull();
  });

  it('strips the activity field from the caller-provided payload', async () => {
    const { manager, enable } = setup({ activity: 'camera' });
    enable();

    manager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: { activity: 'spoofed', metadata: { a: 1 } },
    });
    await flush();

    const payload = sendEventMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect((payload.payload as Record<string, unknown>).activity).toBeUndefined();
    expect(payload.activity).toBe('camera'); // top-level comes from the router
  });

  it('sends CHANGE_CONFIG when a config value changes after init', async () => {
    const { manager, enable, setConfig } = setup();
    enable();
    manager.sendEvent({ eventType: InternalEventType.INIT_SOLUTION });
    await flush();
    sendEventMock.mockClear();

    vi.setSystemTime(1_700_000_000_500); // distinct payload for the dedup check
    setConfig('multiple', false);
    await flush();

    expect(sendEventMock).toHaveBeenCalledTimes(1);
    const payload = sendEventMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.eventType).toBe(InternalEventType.CHANGE_CONFIG);
  });

  it('does not send CHANGE_CONFIG before the solution initialized', async () => {
    const { enable, setConfig } = setup();
    enable();

    setConfig('multiple', false);
    await flush();

    expect(sendEventMock).not.toHaveBeenCalled();
  });

  it('absorbs disabled-time config changes silently when enabled (no spurious CHANGE_CONFIG)', async () => {
    const { manager, enable, setConfig } = setup();
    setConfig('qualityInsights', false); // opt out of the on-by-default state
    setConfig('multiple', false); // disabled → not reported, but…

    enable(); // …absorbed into the snapshot here, before the init event
    manager.sendEvent({ eventType: InternalEventType.INIT_SOLUTION });
    await flush();

    // The init event reports the *current* config (the v1 per-key-subscription
    // implementation carried a stale value here), and the pre-enable change
    // never fires its own CHANGE_CONFIG.
    expect(sendEventMock).toHaveBeenCalledTimes(1);
    const payload = sendEventMock.mock.calls[0]?.[0] as { config: ConfigType };
    expect(payload.config.multiple).toBe(false);
  });

  it('does not resend when the tracked config value is unchanged', async () => {
    const { manager, enable, setConfig } = setup();
    enable();
    setConfig('multiple', false);
    manager.sendEvent({ eventType: InternalEventType.INIT_SOLUTION });
    await flush();
    sendEventMock.mockClear();

    vi.setSystemTime(1_700_000_000_500);
    setConfig('multiple', false); // same value → no CHANGE_CONFIG

    await flush();
    expect(sendEventMock).not.toHaveBeenCalled();
  });

  it('drops high-frequency lifecycle events (excluded list)', async () => {
    const { manager, enable } = setup();
    enable();

    for (const type of [EventType.CHANGE, EventType.FILE_ADDED, EventType.FILE_UPLOAD_PROGRESS]) {
      manager.sendEvent({ eventType: type });
    }
    await flush();

    expect(sendEventMock).not.toHaveBeenCalled();
  });

  it('dedupes an identical consecutive payload', async () => {
    const { manager, enable } = setup();
    enable();

    manager.sendEvent({ eventType: EventType.MODAL_OPEN, modalId: 'start-from' });
    await flush();
    manager.sendEvent({ eventType: EventType.MODAL_OPEN, modalId: 'start-from' });
    await flush();

    expect(sendEventMock).toHaveBeenCalledTimes(1);
  });

  it('sends again when the payload differs (new timestamp)', async () => {
    const { manager, enable } = setup();
    enable();

    manager.sendEvent({ eventType: EventType.MODAL_OPEN });
    await flush();
    vi.setSystemTime(1_700_000_001_000);
    manager.sendEvent({ eventType: EventType.MODAL_OPEN });
    await flush();

    expect(sendEventMock).toHaveBeenCalledTimes(2);
  });

  it('reports a null activity before the router instance exists', async () => {
    const { manager, enable } = setup({ router: false });
    enable();

    manager.sendEvent({ eventType: InternalEventType.INIT_SOLUTION });
    await flush();

    const payload = sendEventMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.activity).toBeNull();
  });

  it('dedupes payloads that differ only in key order', async () => {
    const { manager, enable } = setup();
    enable();

    manager.sendEvent({ eventType: EventType.MODAL_OPEN, payload: { metadata: { a: 1, b: 2 } } });
    await flush();
    manager.sendEvent({ eventType: EventType.MODAL_OPEN, payload: { metadata: { b: 2, a: 1 } } });
    await flush();

    expect(sendEventMock).toHaveBeenCalledTimes(1);
  });

  it('sendEventError wraps the error into ERROR_EVENT metadata', async () => {
    const { manager, enable } = setup();
    enable();

    manager.sendEventError(new Error('boom'), 'upload');
    await flush();

    const payload = sendEventMock.mock.calls[0]?.[0] as { eventType: string; payload: { metadata: unknown } };
    expect(payload.eventType).toBe(InternalEventType.ERROR_EVENT);
    expect(payload.payload.metadata).toEqual({ event: 'error', text: 'Error in upload', error: 'boom' });
  });

  it('sendEventError defaults the context to "unknown"', async () => {
    const { manager, enable } = setup();
    enable();

    manager.sendEventError(new Error('boom'));
    await flush();

    const payload = sendEventMock.mock.calls[0]?.[0] as { payload: { metadata: { text: string } } };
    expect(payload.payload.metadata.text).toBe('Error in unknown');
  });

  it('sendEventCloudImageEditor reports the interaction metadata', async () => {
    const { manager, enable } = setup();
    enable();
    const button = document.createElement('button');
    const event = { currentTarget: button, type: 'click' } as unknown as MouseEvent;

    manager.sendEventCloudImageEditor(event, 'crop', { extra: 1 });
    await flush();

    const payload = sendEventMock.mock.calls[0]?.[0] as { eventType: string; payload: { metadata: unknown } };
    expect(payload.eventType).toBe(InternalEventType.ACTION_EVENT);
    expect(payload.payload.metadata).toEqual({ tabId: 'crop', node: 'BUTTON', event: 'click', extra: 1 });
  });
});
