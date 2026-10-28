import type { TelemetryRequest } from '@uploadcare/quality-insights';
import { TelemetryAPIService } from '@uploadcare/quality-insights';
import { Queue } from '@uploadcare/upload-client';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../env';
import type { ConfigType } from '../../types/index';
import { redactSecrets } from '../../utils/redactSecrets';
import { UID } from '../../utils/UID';
import { initialConfig } from '../config/initialConfig';
import { controllerLogger } from '../controllerLogger';
import { AppInfo } from '../controllers/AppInfo';
import { ConfigController } from '../controllers/ConfigController';
import { RouterController } from '../controllers/RouterController';
import { lifetimeOf } from '../di/ControllerContainer';
import { Disposables } from '../di/Disposables';
import { inject } from '../di/inject';
import { EventBus } from '../EventBus';
import type { EventKey, InternalEventKey } from '../EventEmitter';
import { EventType, InternalEventType } from '../EventEmitter';

type CommonEventType = InternalEventKey | EventKey;

type TelemetryState = TelemetryRequest & {
  eventTimestamp: number;
  location: string;
};
type TelemetryEventBody = Partial<Pick<TelemetryState, 'payload' | 'config' | 'component'>> & {
  modalId?: string;
  eventType: CommonEventType;
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
  'authToken',
  'secureSignature',
  'secureExpire',
  'secureDeliveryProxy',
  'secureUploadsSignatureResolver',
  'secureDeliveryProxyUrlResolver',
  'metadata',
] as const);

const REDACTED_VALUE = '[redacted]';

/** Uploader events that are too frequent, or too per-file, to report to telemetry. */
const EXCLUDED_EVENTS: ReadonlySet<CommonEventType> = new Set([
  EventType.CHANGE,
  EventType.COMMON_UPLOAD_PROGRESS,
  EventType.FILE_ADDED,
  EventType.FILE_REMOVED,
  EventType.FILE_UPLOAD_START,
  EventType.FILE_UPLOAD_PROGRESS,
  EventType.FILE_UPLOAD_SUCCESS,
  EventType.FILE_UPLOAD_FAILED,
]);

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

  // Per-ctx gated logger: the verbose tier prints only when THIS ctx's `debug`
  // config is on; ctx-name + gate resolve lazily at log time via the container
  // that built this instance. Used only by `sendEventError`'s never-throw guard.
  private readonly _log = controllerLogger(this, 'telemetry');

  private readonly _sessionId: string = UID.generateRandomUUID();
  private readonly _telemetryInstance: TelemetryAPIService = new TelemetryAPIService();
  private _config: ConfigType = structuredClone(initialConfig);
  private _initialized = false;
  // The component an init event named (the standalone editor's, which registers no `solutionName`), for every later
  // event that names none.
  private _initComponent: string | null = null;
  private _lastPayload: TelemetryState | null = null;
  /** The config as last shipped — what a `CHANGE_CONFIG` has to differ from to be worth sending. */
  private _reportedConfig: TelemetryState['config'] | null = null;
  #configChangePending = false;
  private readonly _queue: Queue = new Queue(10);
  readonly #disposables = new Disposables();

  /**
   * Container lifecycle hook — runs after the container has tagged + cached this
   * instance, so `@inject` fields resolve. Subscribes to the config store (for
   * `CHANGE_CONFIG` tracking) and, as a bus observer, to every emitted event.
   */
  public init(): void {
    this.#disposables.add(this._configController.subscribe(() => this._trackConfigChange()));
    // Seed the snapshot with the current values (nothing is sent before
    // `_initialized`, matching the v1 immediate-subscription pass).
    this._trackConfigChange();
    // Observe the per-ctx bus: every `EventEmitter.emit` reaches here, so
    // telemetry sees every event without any per-emit mirror. The bus fan-out
    // is isolate-and-warn (see `EventBus.emit`), so a throw here can't break the
    // fan-out — no extra try/catch needed around this observer.
    this.#disposables.add(
      this._bus.onAny((type, payload) =>
        this.sendEvent({
          eventType: type as CommonEventType,
          payload: (payload ?? undefined) as Record<string, unknown> | undefined,
        }),
      ),
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
      this._reportConfigChange();
    }
  }

  /**
   * `CHANGE_CONFIG` reports the snapshot, so it is worth an event only once that
   * snapshot differs from the one telemetry last shipped. The check waits a
   * microtask because the events that carry a config are formatted on one too:
   * a `<uc-config>` seed lands in the `init-solution` already queued ahead of it,
   * and reporting the same values again right behind it says nothing.
   */
  private _reportConfigChange(): void {
    if (this.#configChangePending) {
      return;
    }
    this.#configChangePending = true;
    const lifetime = lifetimeOf(this);
    lifetime.run(
      async () => {
        await Promise.resolve();
        this.#configChangePending = false;
        if (lifetime.signal.aborted || !this._isEnabled) {
          return;
        }
        if (this._reportedConfig && this._checkObj(this._reportedConfig, this._sanitizedConfig())) {
          return;
        }
        this.sendEvent({ eventType: InternalEventType.CHANGE_CONFIG });
      },
      (error) => this._log.debug('failed to report a config change', error),
    );
  }

  private _sanitizedConfig(): TelemetryState['config'] {
    const sanitized: Record<string, unknown> = redactSecrets(this._config);
    for (const key of SENSITIVE_CONFIG_KEYS) {
      if (this._config[key] !== initialConfig[key]) {
        sanitized[key] = REDACTED_VALUE;
      }
    }
    return sanitized as TelemetryState['config'];
  }

  private _markInitialized(type: CommonEventType | undefined): void {
    if (type === InternalEventType.INIT_SOLUTION) {
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
      component: body.component ?? this._solution ?? this._initComponent,
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

  private _isExcludedEvent(type: CommonEventType | undefined): boolean {
    return type !== undefined && EXCLUDED_EVENTS.has(type);
  }

  public sendEvent(body: TelemetryEventBody): void {
    // Nothing leaves the uploader once its ctx is destroyed — not even an event a late caller reports.
    const lifetime = lifetimeOf(this);
    if (lifetime.signal.aborted || !this._isEnabled) {
      return;
    }

    this._markInitialized(body.eventType);
    if (body.eventType === InternalEventType.INIT_SOLUTION && body.component) {
      this._initComponent = body.component;
    }

    if (this._isExcludedEvent(body.eventType)) {
      return;
    }
    // Copied now, while the config waits for the send: event payloads such as `OutputCollectionState` are getters over
    // live state, and read after the yield below they would describe a later moment than the event.
    const eventPayload = body.payload ? { ...body.payload } : undefined;

    lifetime.run(
      () =>
        this._queue.add(async () => {
          // Yield once, then RE-CHECK: `Queue` runs a task synchronously while below
          // its concurrency limit, and a startup event can be emitted from inside
          // `UploaderRegistry.ensure()` — which `<uc-config>` itself triggers, from
          // its own adoption, BEFORE `_seedBuiltInConfig` has applied its attributes.
          // At that instant `qualityInsights` still reads its `true` default, so
          // without this yield an explicit `quality-insights="false"` page still
          // ships its whole startup burst (verified: 5 events on the standalone
          // editor demo). One microtask lands after the seed; the opt-out is then
          // visible and the event is dropped instead of sent.
          await Promise.resolve();
          // Also drops events still queued when the ctx is destroyed.
          if (lifetime.signal.aborted || !this._isEnabled) {
            return;
          }
          // Format AFTER the yield, not at emit time: `controllerReady` sends
          // `init-solution` while the solution element connects — one task before
          // `<uc-config>` has upgraded and seeded its attributes — so a payload built
          // eagerly ships the default config and an empty `projectPubkey`. Building it
          // at send time reports the config the page actually configured.
          const payload = this._formattingPayload({
            eventType: body.eventType,
            payload: eventPayload,
            config: body.config,
            component: body.component,
          });
          // The repeat-event dedup moved down here with it — it has to compare what
          // actually ships, not two different pre-seed snapshots.
          if (this._lastPayload && this._checkObj(this._lastPayload, payload)) {
            return;
          }
          this._lastPayload = payload;
          if (payload.config) {
            this._reportedConfig = payload.config;
          }
          await this._telemetryInstance.sendEvent(payload);
        }),
      // Telemetry is best-effort (often blocked by the page): a failed send is verbose-only noise, not an error.
      (error) => this._log.debug('failed to send a telemetry event', error),
    );
  }

  /**
   * Report an error to telemetry. This is a terminal error SINK — it must never
   * throw, or the original failure it reports (a rejected upload/validator/
   * resolver handler, often on an async path) would surface as an unhandled
   * rejection. A failed send is logged on the verbose tier only.
   */
  public sendEventError(error: unknown, context = 'unknown'): void {
    try {
      this.sendEvent({
        eventType: InternalEventType.ERROR_EVENT,
        payload: {
          metadata: {
            event: 'error',
            text: `Error in ${context}`,
            // Non-`Error` throwables (strings, DOMException, …) have no `.message`;
            // stringify them rather than reporting `undefined`.
            error: error instanceof Error ? error.message : String(error),
          },
        },
      });
    } catch (err) {
      this._log.debug('failed to report an error event to telemetry', err);
    }
  }

  /** Report a UI action: `event` names it, `node` is the tag of the element that reported it. */
  public sendActionEvent(event: string, node: string | undefined, extra: Record<string, unknown> = {}): void {
    this.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: { metadata: { event, node, ...extra } },
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
    // Runs the config-subscription and bus-observer teardowns. Detaching the bus
    // observer is safe even if the container already disposed the EventBus (its
    // `destroy()` cleared listeners): the returned unsubscribe is an idempotent
    // `Set.delete`.
    this.#disposables.run();
  }
}
