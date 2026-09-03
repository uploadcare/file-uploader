import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter, EventType, InternalEventType } from '../../blocks/UploadCtxProvider/EventEmitter';
import type { ActivityId } from '../../lit/activity-constants';
import type { ConfigType } from '../../types/index';
import { AppInfo } from '../controllers/AppInfo';
import { ConfigController } from '../controllers/ConfigController';
import { RouterController } from '../controllers/RouterController';
import { ControllerContainer } from '../di/ControllerContainer';
import { TelemetryManager } from './TelemetryManager';

const sendEventMock = vi.hoisted(() => vi.fn(async (_payload: Record<string, unknown>) => {}));

vi.mock('@uploadcare/quality-insights', () => ({
  TelemetryAPIService: class {
    public sendEvent = sendEventMock;
  },
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// TelemetryManager is container-resolved now (M-god step 3c): a zero-arg ctor
// that `@inject`s ConfigController/EventBus/AppInfo/RouterController and, in
// `init()`, subscribes to the config store AND observes the bus (`onAny`). Build
// all collaborators through one throwaway container so the manager injects the
// same instances the specs read/spy on. `solution`/`activity` are seeded on
// AppInfo/RouterController BEFORE the manager is built, so the seeding
// navigation never reaches the not-yet-subscribed observer.
const setup = ({
  solution,
  activity = null,
  router = true,
}: {
  solution?: string;
  activity?: string | null;
  router?: boolean;
} = {}) => {
  const container = new ControllerContainer();
  const config = container.get(ConfigController);
  const appInfo = container.get(AppInfo);
  const routerCtrl = container.get(RouterController);
  if (solution) {
    appInfo.setSolutionName(solution);
  }
  if (router && activity) {
    routerCtrl.setActivity(activity as ActivityId);
  }
  const manager = container.get(TelemetryManager); // init() → config + bus subscriptions

  const setConfig = <K extends keyof ConfigType>(key: K, value: ConfigType[K]) => config.set(key, value);
  const enable = () => setConfig('qualityInsights', true);
  // Emit through the container's real EventEmitter → the bus the manager
  // observes, exercising the observer path end-to-end.
  const emitOnBus = (type: Parameters<EventEmitter['emit']>[0], payload?: Parameters<EventEmitter['emit']>[1]) =>
    container.get(EventEmitter).emit(type, payload);

  return { manager, setConfig, enable, emitOnBus, container, config, appInfo, router: routerCtrl };
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

  it('drops events queued before an opt-out lands (config element upgrades after the emitter)', async () => {
    // Real-world shape: `qualityInsights` defaults to `true`, and
    // `defineComponents` upgrades e.g. `uc-cloud-image-editor` several tags
    // ahead of `uc-config`, so a block can connect and emit its startup burst
    // while the explicit `quality-insights="false"` is still unapplied. The
    // queue flushes after that, so the send must re-check.
    const { manager, setConfig } = setup();
    manager.sendEvent({ eventType: InternalEventType.INIT_SOLUTION });
    setConfig('qualityInsights', false);
    await flush();
    expect(sendEventMock).not.toHaveBeenCalled();
  });

  it('sends the init event with app/session/config metadata once enabled', async () => {
    const { manager, enable } = setup({ solution: 'uc-file-uploader-regular', activity: 'start-from' });
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

  it('lets an event carry its own component, overriding the registered solution', async () => {
    // The standalone editor solution attributes its own events without
    // registering an uploader `solutionName`.
    const { manager, enable } = setup({ solution: 'uc-file-uploader-regular' });
    enable();

    manager.sendEvent({ eventType: InternalEventType.INIT_SOLUTION, component: 'uc-cloud-image-editor' });
    await flush();

    const payload = sendEventMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.component).toBe('uc-cloud-image-editor');
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

  it('resolves solution/activity live from AppInfo/RouterController, reflecting post-init registration', async () => {
    // The solution/activity payload fields read the container-owned
    // AppInfo/RouterController on every send, not a construction-time snapshot.
    // Building the manager while both are still unset must not freeze null
    // forever — a later `setSolutionName`/`setActivity` must be reflected.
    const { manager, appInfo, router } = setup(); // enabled by default
    manager.sendEvent({ eventType: InternalEventType.INIT_SOLUTION });
    await flush();
    let payload = sendEventMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.component).toBeNull();
    expect(payload.activity).toBeNull();

    appInfo.setSolutionName('UC-FILE-UPLOADER-REGULAR');
    router.setActivity('start-from' as ActivityId);
    // setActivity emitted ACTIVITY_CHANGE → the observer already sent it; drop
    // that so the assertion below inspects only our explicit MODAL_OPEN send.
    // Flush first: a send resolves its enabled-check on a microtask, so the
    // delivery lands after this statement rather than during `setActivity`.
    await flush();
    sendEventMock.mockClear();
    vi.setSystemTime(1_700_000_002_000); // distinct payload for the dedup check
    manager.sendEvent({ eventType: EventType.MODAL_OPEN });
    await flush();

    expect(sendEventMock).toHaveBeenCalledTimes(1);
    payload = sendEventMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.component).toBe('uc-file-uploader-regular');
    expect(payload.activity).toBe('start-from');
  });

  describe('bus observer (M-god step 3c)', () => {
    it('an event emitted on the bus reaches telemetry (replaces the per-emit mirror)', async () => {
      const { emitOnBus } = setup({ solution: 'uc-file-uploader-regular' }); // enabled by default

      emitOnBus(EventType.UPLOAD_CLICK);
      await flush();

      expect(sendEventMock).toHaveBeenCalledTimes(1);
      const payload = sendEventMock.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload.eventType).toBe(EventType.UPLOAD_CLICK);
      expect(payload.component).toBe('uc-file-uploader-regular');
    });

    it('an observed excluded event (file-upload-progress) is still dropped by the internal filter', async () => {
      const { emitOnBus } = setup();

      emitOnBus(EventType.FILE_UPLOAD_PROGRESS, {} as never);
      await flush();

      expect(sendEventMock).not.toHaveBeenCalled();
    });

    it('newly telemeters common-upload-start observed off the bus (documented parity change: uploadAll)', async () => {
      // uploadAll (and emitCommonUploadFailed) emit directly on the EventEmitter,
      // bypassing the old per-emit mirror — telemetry never saw them before.
      // As a bus observer it now does, an intended consistency improvement.
      const { emitOnBus } = setup({ solution: 'uc-file-uploader-regular' });

      emitOnBus(EventType.COMMON_UPLOAD_START, {} as never);
      await flush();

      expect(sendEventMock).toHaveBeenCalledTimes(1);
      expect((sendEventMock.mock.calls[0]?.[0] as Record<string, unknown>).eventType).toBe(
        EventType.COMMON_UPLOAD_START,
      );
    });

    it('sends nothing observed off the bus while disabled', async () => {
      const { emitOnBus, setConfig } = setup();
      setConfig('qualityInsights', false);

      emitOnBus(EventType.UPLOAD_CLICK);
      await flush();

      expect(sendEventMock).not.toHaveBeenCalled();
    });

    it("a debounced modal emit (RouterController._emit's {debounce:true} path) is not seen synchronously, then reaches telemetry once the window elapses", async () => {
      // RouterController._emit debounces MODAL_OPEN/MODAL_CLOSE via
      // `EventEmitter.emit(type, payload, { debounce: true })` →
      // `EventBus.emitDebounced` (~20ms). Telemetry, as a bus observer, sees
      // that already-debounced delivery — this pins the accepted behavior
      // change (modal telemetry is no longer synchronous with the transition).
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
      vi.setSystemTime(1_700_000_000_000);
      const { container, enable } = setup({ solution: 'uc-file-uploader-regular' });
      enable();
      const emitter = container.get(EventEmitter);

      emitter.emit(EventType.MODAL_OPEN, { modalId: 'start-from' } as never, { debounce: true });

      // Still inside the debounce window — must not have fired yet.
      expect(sendEventMock).not.toHaveBeenCalled();

      // `…Async` so the send's microtask-deferred enabled-check settles too.
      await vi.advanceTimersByTimeAsync(20);

      expect(sendEventMock).toHaveBeenCalledTimes(1);
      const payload = sendEventMock.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload.eventType).toBe(EventType.MODAL_OPEN);
    });

    it('two rapid same-type debounced emits within the window collapse into a single telemetry delivery', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
      vi.setSystemTime(1_700_000_000_000);
      const { container, enable } = setup({ solution: 'uc-file-uploader-regular' });
      enable();
      const emitter = container.get(EventEmitter);

      emitter.emit(EventType.MODAL_OPEN, { modalId: 'start-from' } as never, { debounce: true });
      emitter.emit(EventType.MODAL_OPEN, { modalId: 'start-from' } as never, { debounce: true });

      await vi.advanceTimersByTimeAsync(20);

      // Collapsed by EventBus.emitDebounced (later emit resets the pending
      // timer) — telemetry sees one delivery, not two.
      expect(sendEventMock).toHaveBeenCalledTimes(1);
    });
  });

  it("defaults a missing eventType to '' in the payload", async () => {
    const { manager, enable } = setup();
    enable();

    manager.sendEvent({});
    await flush();

    const payload = sendEventMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.eventType).toBe('');
  });

  it('re-sends when only a deeply-nested payload value differs (deep _checkObj recursion miss)', async () => {
    const { manager, enable } = setup();
    enable();

    // Same timestamp + same structure, differing only in a nested leaf — forces
    // `_checkObj` past the top-level JSON compare into the recursive key walk.
    manager.sendEvent({ eventType: EventType.MODAL_OPEN, payload: { metadata: { a: 1 } } });
    await flush();
    manager.sendEvent({ eventType: EventType.MODAL_OPEN, payload: { metadata: { a: 2 } } });
    await flush();

    expect(sendEventMock).toHaveBeenCalledTimes(2);
  });

  it('re-sends when a nested object gains/loses a key (deep _checkObj length miss)', async () => {
    const { manager, enable } = setup();
    enable();

    manager.sendEvent({ eventType: EventType.MODAL_OPEN, payload: { metadata: { a: 1, b: 2 } } });
    await flush();
    manager.sendEvent({ eventType: EventType.MODAL_OPEN, payload: { metadata: { a: 1 } } });
    await flush();

    expect(sendEventMock).toHaveBeenCalledTimes(2);
  });

  it('re-sends when a nested object swaps a key name for one of equal count (deep _checkObj key miss)', async () => {
    const { manager, enable } = setup();
    enable();

    manager.sendEvent({ eventType: EventType.MODAL_OPEN, payload: { metadata: { a: 1 } } });
    await flush();
    manager.sendEvent({ eventType: EventType.MODAL_OPEN, payload: { metadata: { b: 1 } } });
    await flush();

    expect(sendEventMock).toHaveBeenCalledTimes(2);
  });

  describe('destroy', () => {
    it('before init() (never container-resolved) is a no-op — the default unsubs are safe', () => {
      // A manager built outside a container never ran `init()`, so its `_unsub*`
      // fields are the default no-ops; `destroy()` must tolerate that.
      expect(() => new TelemetryManager().destroy()).not.toThrow();
    });

    it('unsubscribes from the config store and the bus — no sends afterward', async () => {
      const { manager, setConfig, emitOnBus } = setup();
      manager.sendEvent({ eventType: InternalEventType.INIT_SOLUTION });
      await flush();
      sendEventMock.mockClear();

      manager.destroy();

      setConfig('multiple', false); // config change → CHANGE_CONFIG would fire if still subscribed
      emitOnBus(EventType.UPLOAD_CLICK); // bus event → observer detached
      await flush();

      expect(sendEventMock).not.toHaveBeenCalled();
    });
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

  // `sendEventError` is a terminal error SINK (it reports failures from async
  // upload/validator/resolver handlers), so it must never throw back into the
  // caller — that guarantee moved here from the removed `UploadHostBridge`
  // telemetry sinks. When the underlying send throws, it swallows and logs via
  // the per-ctx gated debug tier rather than rethrowing.
  it('sendEventError never rethrows when the underlying send throws, logging via the gated debug', () => {
    const { manager, config } = setup();
    config.set('debug', true); // open this ctx's gated verbose tier
    const debug = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(manager, 'sendEvent').mockImplementation(() => {
      throw new Error('telemetry sink is down');
    });
    // The file's afterEach doesn't restore spies, so isolate to THIS action's calls.
    debug.mockClear();

    expect(() => manager.sendEventError(new Error('boom'), 'upload')).not.toThrow();
    expect(debug.mock.calls.some((call) => call.includes('failed to report an error event to telemetry'))).toBe(true);
  });

  it('sendEventError stays silent (no throw) when the send throws and verbose is off', () => {
    const { manager } = setup(); // debug config off by default → gated debug suppressed
    const debug = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(manager, 'sendEvent').mockImplementation(() => {
      throw new Error('telemetry sink is down');
    });
    debug.mockClear();

    expect(() => manager.sendEventError(new Error('boom'))).not.toThrow();
    expect(debug.mock.calls.some((call) => call.includes('failed to report an error event to telemetry'))).toBe(false);
  });

  it('sendEventError does not rethrow even when the fallback log itself throws', () => {
    const { manager, config } = setup();
    config.set('debug', true);
    // Both the send AND the fallback debug log throw (a host-patched console) —
    // the nested guard must still swallow, or the original failure escapes.
    vi.spyOn(manager, 'sendEvent').mockImplementation(() => {
      throw new Error('telemetry sink is down');
    });
    vi.spyOn(console, 'log').mockImplementation(() => {
      throw new Error('console is patched to throw');
    });

    expect(() => manager.sendEventError(new Error('boom'), 'upload')).not.toThrow();
  });

  it('sendEventError stringifies a non-Error throwable instead of reporting undefined', async () => {
    const { manager, enable } = setup();
    enable();

    manager.sendEventError('plain string failure', 'resolver');
    await flush();

    const payload = sendEventMock.mock.calls[0]?.[0] as { payload: { metadata: { error: unknown } } };
    expect(payload.payload.metadata.error).toBe('plain string failure');
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
