import type { TelemetryRequest } from '@uploadcare/quality-insights';
import { TelemetryAPIService } from '@uploadcare/quality-insights';
import { Queue } from '@uploadcare/upload-client';
import { initialConfig } from '../../blocks/Config/initialConfig';
import type { EventKey, InternalEventKey } from '../../blocks/UploadCtxProvider/EventEmitter';
import { EventType, InternalEventType } from '../../blocks/UploadCtxProvider/EventEmitter';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../env';
import type { ConfigType } from '../../types/index';
import { UID } from '../../utils/UID';
import type { ConfigController } from '../controllers/ConfigController';

type CommonEventType = InternalEventKey | EventKey;

type TelemetryState = TelemetryRequest & {
  eventTimestamp: number;
  location: string;
};
type TelemetryEventBody = Partial<Pick<TelemetryState, 'payload' | 'config'>> & {
  modalId?: string;
  eventType?: CommonEventType;
};

export type TelemetryManagerDeps = {
  /** v2 config source of truth — enablement, snapshot, and change detection. */
  config: ConfigController;
  /** Solution tag name (lowercased for the payload); null before a solution registers. */
  getSolution: () => string | null;
  /** Effective current activity; null before the router exists / nothing open. */
  getActivity: () => string | null;
};

/**
 * Quality-insights telemetry (M8 port): deps-injected instead of
 * `SharedInstance`-based — enablement and config tracking read the v2
 * `ConfigController` directly (one coarse subscription + snapshot diff
 * replaces the per-`*cfg/*`-key ctx subscriptions), and the solution/activity
 * payload fields come from injected getters, so nothing here touches the `$`
 * state.
 */
export class TelemetryManager {
  private readonly _deps: TelemetryManagerDeps;
  private readonly _sessionId: string = UID.generateRandomUUID();
  private readonly _telemetryInstance: TelemetryAPIService;
  private _config: ConfigType = structuredClone(initialConfig);
  private _initialized = false;
  private _lastPayload: TelemetryState | null = null;
  private readonly _queue: Queue;
  private _unsubConfig: () => void;

  public constructor(deps: TelemetryManagerDeps) {
    this._deps = deps;
    this._telemetryInstance = new TelemetryAPIService();
    this._queue = new Queue(10);

    this._unsubConfig = deps.config.subscribe(() => this._trackConfigChange());
    // Seed the snapshot with the current values (nothing is sent before
    // `_initialized`, matching the v1 immediate-subscription pass).
    this._trackConfigChange();
  }

  private get _isEnabled(): boolean {
    return Boolean(this._deps.config.get('qualityInsights'));
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
      const value = this._deps.config.get(key);
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

  private _init(type: CommonEventType | undefined): void {
    if (type === InternalEventType.INIT_SOLUTION && !this._initialized) {
      this._initialized = true;
    }
  }

  private _formattingPayload(body: Partial<Pick<TelemetryState, 'eventType' | 'payload' | 'config'>>): TelemetryState {
    const payload = (body.payload ? { ...body.payload } : {}) as Record<string, unknown>;
    if (payload.activity) {
      payload.activity = undefined;
    }

    const result: Partial<Pick<TelemetryState, 'eventType' | 'payload' | 'config'>> = { ...body };
    if (body.eventType === InternalEventType.INIT_SOLUTION || body.eventType === InternalEventType.CHANGE_CONFIG) {
      result.config = this._config as TelemetryState['config'];
    }

    return {
      ...result,

      appVersion: PACKAGE_VERSION,
      appName: PACKAGE_NAME,
      sessionId: this._sessionId,
      component: this._solution,
      activity: this._deps.getActivity(),
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
    const solution = this._deps.getSolution();
    return solution ? solution.toLowerCase() : null;
  }

  private get _location(): string {
    return location.origin;
  }

  public destroy(): void {
    this._unsubConfig();
  }
}
