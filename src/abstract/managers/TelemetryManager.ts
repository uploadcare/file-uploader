import type { TelemetryRequest } from '@uploadcare/quality-insights';
import { TelemetryAPIService } from '@uploadcare/quality-insights';
import { Queue } from '@uploadcare/upload-client';
import { initialConfig } from '../../blocks/Config/initialConfig';
import type { EventKey, InternalEventKey } from '../../blocks/UploadCtxProvider/EventEmitter';
import { EventType, InternalEventType } from '../../blocks/UploadCtxProvider/EventEmitter';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../env';
import type { ConfigType } from '../../types/index';
import { UID } from '../../utils/UID';
import { AppInfo } from '../controllers/AppInfo';
import { ConfigController } from '../controllers/ConfigController';
import { RouterController } from '../controllers/RouterController';
import { inject } from '../di/inject';
import { EventBus } from '../EventBus';

type CommonEventType = InternalEventKey | EventKey;

type TelemetryState = TelemetryRequest & {
  eventTimestamp: number;
  location: string;
};
type TelemetryEventBody = Partial<Pick<TelemetryState, 'payload' | 'config' | 'component'>> & {
  modalId?: string;
  eventType?: CommonEventType;
};

/**
 * Config keys whose *values* must never leave the page via telemetry: the
 * `secure*` options and integrator-supplied `metadata`. They are not dropped
 * from the snapshot — a non-default value is replaced with
 * {@link REDACTED_VALUE}, so the data still shows the option is in use while
 * the value itself stays private. The full snapshot is still tracked
 * internally for change detection.
 */
const SENSITIVE_CONFIG_KEYS: ReadonlySet<keyof ConfigType> = new Set([
  'secureSignature',
  'secureExpire',
  'secureDeliveryProxy',
  'secureUploadsSignatureResolver',
  'secureDeliveryProxyUrlResolver',
  'metadata',
] as const);

const REDACTED_VALUE = '[redacted]';

/**
 * Quality-insights telemetry (M8 port): container-resolved (M-god step 3c) and
 * an EventBus OBSERVER. Enablement and config tracking read the v2
 * `ConfigController` directly (one coarse subscription + snapshot diff replaces
 * the per-`*cfg/*`-key ctx subscriptions); the solution/activity payload fields
 * read the container-owned `AppInfo`/`RouterController` lazily, so nothing here
 * touches the `$` state.
 *
 * `init()` subscribes to `bus.onAny` and forwards every emitted event to
 * `sendEvent` — replacing the per-emit telemetry mirror that
 * `UploaderController.emit`/`ChildBlock.emit` used to carry (the "augmented
 * emit" god-method). The bus fires on every `EventEmitter.emit`, so telemetry
 * still sees every event those paths dispatch; it additionally sees the direct
 * `eventEmitter.emit` callers (`uploadAll`'s `common-upload-start`,
 * `emitCommonUploadFailed`'s `common-upload-failed`) that the old per-path
 * mirror never reached — an intended consistency improvement.
 */
export class TelemetryManager {
  // Container-resolved collaborators (M-god step 3c). `ConfigController` is a
  // direct `@inject` (no import cycle); the rest are thunked because the event
  // surface's module graph is circular-prone. All resolve lazily on access.
  @inject(ConfigController) private readonly _configController!: ConfigController;
  @inject(() => EventBus) private readonly _bus!: EventBus;
  @inject(() => AppInfo) private readonly _appInfo!: AppInfo;
  @inject(() => RouterController) private readonly _router!: RouterController;

  private readonly _sessionId: string = UID.generateRandomUUID();
  private readonly _telemetryInstance: TelemetryAPIService = new TelemetryAPIService();
  private _config: ConfigType = structuredClone(initialConfig);
  private _initialized = false;
  private _lastPayload: TelemetryState | null = null;
  private readonly _queue: Queue = new Queue(10);
  private _unsubConfig: () => void = () => {};
  private _unsubBus: () => void = () => {};

  /**
   * Container lifecycle hook — runs after the container has tagged + cached this
   * instance, so `@inject` fields resolve. Subscribes to the config store (for
   * `CHANGE_CONFIG` tracking) and, as a bus observer, to every emitted event.
   */
  public init(): void {
    this._unsubConfig = this._configController.subscribe(() => this._trackConfigChange());
    // Seed the snapshot with the current values (nothing is sent before
    // `_initialized`, matching the v1 immediate-subscription pass).
    this._trackConfigChange();
    // Observe the per-ctx bus: every `EventEmitter.emit` reaches here, so
    // telemetry sees every event without any per-emit mirror. The bus fan-out
    // is isolate-and-warn (see `EventBus.emit`), so a throw here can't break the
    // fan-out — no extra try/catch needed around this observer.
    this._unsubBus = this._bus.onAny((type, payload) =>
      this.sendEvent({
        eventType: type as CommonEventType,
        payload: (payload ?? undefined) as Record<string, unknown> | undefined,
      }),
    );
  }

  private get _isEnabled(): boolean {
    return Boolean(this._configController.get('qualityInsights'));
  }

  /**
   * Diff the tracked snapshot against the config controller. Disabled
   * telemetry tracks nothing (v1 parity); a change after the init event sends
   * `CHANGE_CONFIG` with the updated snapshot attached.
   */
  private _trackConfigChange(): void {
    if (!this._isEnabled) {
      return;
    }
    let changed = false;
    for (const key of Object.keys(this._config) as (keyof ConfigType)[]) {
      const value = this._configController.get(key);
      if (this._config[key] !== value) {
        changed = true;
        (this._config as Record<string, unknown>)[key] = value;
      }
    }
    if (changed && this._initialized) {
      this.sendEvent({
        eventType: InternalEventType.CHANGE_CONFIG,
      });
    }
  }

  private _sanitizedConfig(): TelemetryState['config'] {
    const sanitized: Record<string, unknown> = { ...this._config };
    for (const key of SENSITIVE_CONFIG_KEYS) {
      if (this._config[key] !== initialConfig[key]) {
        sanitized[key] = REDACTED_VALUE;
      }
    }
    return sanitized as TelemetryState['config'];
  }

  private _init(type: CommonEventType | undefined): void {
    if (type === InternalEventType.INIT_SOLUTION && !this._initialized) {
      this._initialized = true;
    }
  }

  private _formattingPayload(
    body: Partial<Pick<TelemetryState, 'eventType' | 'payload' | 'config' | 'component'>>,
  ): TelemetryState {
    const payload = (body.payload ? { ...body.payload } : {}) as Record<string, unknown>;
    if (payload.activity) {
      payload.activity = undefined;
    }

    const result: Partial<Pick<TelemetryState, 'eventType' | 'payload' | 'config'>> = { ...body };
    if (body.eventType === InternalEventType.INIT_SOLUTION || body.eventType === InternalEventType.CHANGE_CONFIG) {
      result.config = this._sanitizedConfig();
    }

    return {
      ...result,

      appVersion: PACKAGE_VERSION,
      appName: PACKAGE_NAME,
      sessionId: this._sessionId,
      // A caller may attribute an event to its own component (the standalone
      // editor solution does this, since it registers no uploader
      // `solutionName`); otherwise fall back to the registered solution.
      component: body.component ?? this._solution,
      activity: this._router.currentActivity,
      projectPubkey: this._config.pubkey,
      userAgent: navigator.userAgent,
      eventType: result.eventType ?? '',
      eventTimestamp: this._timestamp,

      payload: {
        location: this._location,
        ...payload,
      } as TelemetryState['payload'],
    } as TelemetryState;
  }

  private _excludedEvents(type: CommonEventType | undefined): boolean {
    if (
      type &&
      [
        EventType.CHANGE,
        EventType.COMMON_UPLOAD_PROGRESS,
        EventType.FILE_ADDED,
        EventType.FILE_REMOVED,
        EventType.FILE_UPLOAD_START,
        EventType.FILE_UPLOAD_PROGRESS,
        EventType.FILE_UPLOAD_SUCCESS,
        EventType.FILE_UPLOAD_FAILED,
      ].includes(type)
    ) {
      return true;
    }

    return false;
  }

  public sendEvent(body: TelemetryEventBody): void {
    if (!this._isEnabled) {
      return;
    }
    const payload = this._formattingPayload({
      eventType: body.eventType,
      payload: body.payload,
      config: body.config,
      component: body.component,
    });

    this._init(body.eventType);

    const hasExcludedEvents = this._excludedEvents(body.eventType);
    if (hasExcludedEvents) {
      return;
    }

    const hasDataSame = this._lastPayload && this._checkObj(this._lastPayload, payload);
    if (hasDataSame) {
      return;
    }

    this._queue.add(async () => {
      this._lastPayload = payload;
      await this._telemetryInstance.sendEvent(payload);
    });
  }

  public sendEventError(error: unknown, context = 'unknown'): void {
    this.sendEvent({
      eventType: InternalEventType.ERROR_EVENT,
      payload: {
        metadata: {
          event: 'error',
          text: `Error in ${context}`,
          error: (error as Error).message,
        },
      },
    });
  }

  /**
   * Method to send telemetry event for Cloud Image Editor.
   */
  public sendEventCloudImageEditor(e: MouseEvent, tabId: string, options: Record<string, unknown> = {}): void {
    this.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          tabId,
          node: (e.currentTarget as HTMLElement | null)?.tagName,
          event: e.type,
          ...options,
        },
      },
    });
  }

  /**
   * Deeply compares two objects and returns true if they are equal, false otherwise.
   */
  private _checkObj(last: unknown, current: unknown): boolean {
    if (JSON.stringify(last) === JSON.stringify(current)) return true;
    if (typeof last !== 'object' || typeof current !== 'object' || last == null || current == null) return false;
    const lastKeys = Object.keys(last);
    const currentKeys = Object.keys(current);
    if (lastKeys.length !== currentKeys.length) return false;
    for (const key of lastKeys) {
      if (!Object.hasOwn(current, key)) return false;
      if (!this._checkObj((last as Record<string, unknown>)[key], (current as Record<string, unknown>)[key]))
        return false;
    }

    return true;
  }

  private get _timestamp(): number {
    return Date.now();
  }

  private get _solution(): string | null {
    return this._appInfo.solutionName;
  }

  private get _location(): string {
    return location.origin;
  }

  public destroy(): void {
    this._unsubConfig();
    // Detach the bus observer. Safe even if the container already disposed the
    // EventBus (its `destroy()` cleared listeners): the returned unsubscribe is
    // an idempotent `Set.delete`.
    this._unsubBus();
  }
}
