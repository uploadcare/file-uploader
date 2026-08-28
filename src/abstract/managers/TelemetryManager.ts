import type { TelemetryRequest } from '@uploadcare/quality-insights';
import { TelemetryAPIService } from '@uploadcare/quality-insights';
import { Queue } from '@uploadcare/upload-client';
import { initialConfig } from '../../blocks/Config/initialConfig';
import type { EventKey, InternalEventKey } from '../../blocks/UploadCtxProvider/EventEmitter';
import { EventType, InternalEventType } from '../../blocks/UploadCtxProvider/EventEmitter';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../env';
import { SharedInstance, type SharedInstancesBag } from '../../lit/shared-instances';
import type { ConfigType } from '../../types/index';
import { UID } from '../../utils/UID';
import { sharedConfigKey } from '../sharedConfigKey';

type CommonEventType = InternalEventKey | EventKey;

type TelemetryState = TelemetryRequest & {
  eventTimestamp: number;
  location: string;
};
/** The parts of an event that must be captured when it happens, not when it is sent. */
type EventContext = {
  timestamp: number;
  activity: string | null;
  solution: string | null;
};

type TelemetryEventBody = Partial<Pick<TelemetryState, 'payload' | 'config'>> & {
  modalId?: string;
  eventType: CommonEventType;
};

export class TelemetryManager extends SharedInstance {
  private readonly _sessionId: string = UID.generateRandomUUID();
  private readonly _telemetryInstance: TelemetryAPIService;
  private _config: ConfigType = structuredClone(initialConfig);
  private _initialized = false;
  private _lastPayload: TelemetryState | null = null;
  private readonly _queue: Queue;
  private _isEnabled = false;

  public constructor(sharedInstancesBag: SharedInstancesBag) {
    super(sharedInstancesBag);
    this._telemetryInstance = new TelemetryAPIService();
    this._queue = new Queue(10);

    this.addSub(
      this._ctx.sub(sharedConfigKey('qualityInsights'), (value) => {
        this._isEnabled = Boolean(value);
      }),
    );

    for (const key of Object.keys(this._config) as (keyof ConfigType)[]) {
      this.addSub(
        this._ctx.sub(sharedConfigKey(key), (value) => {
          const isChanged = this._config[key] !== value;
          this._setConfig(key, value);

          if (this._isEnabled && this._initialized && isChanged) {
            this.sendEvent({
              eventType: InternalEventType.CHANGE_CONFIG,
            });
          }
        }),
      );
    }
  }

  private _setConfig<T extends keyof ConfigType>(key: T, value: ConfigType[T]): void {
    if (this._config[key] === value) {
      return;
    }

    this._config[key] = value;
  }

  /**
   * Builds the wire payload. Called when the event is sent rather than when it is raised, so that config-derived
   * fields (`config`, `projectPubkey`) reflect the config as delivered; `occurredAt` carries what must not drift.
   */
  private _formattingPayload(
    body: Partial<Pick<TelemetryState, 'eventType' | 'payload' | 'config'>>,
    occurredAt: EventContext,
  ): TelemetryState {
    const payload = (body.payload ? { ...body.payload } : {}) as Record<string, unknown>;
    if (payload.activity) {
      payload.activity = undefined;
    }

    const result: Partial<Pick<TelemetryState, 'eventType' | 'payload' | 'config'>> = { ...body };
    if (body.eventType === InternalEventType.INIT_SOLUTION || body.eventType === InternalEventType.CHANGE_CONFIG) {
      result.config = { ...this._config } as TelemetryState['config'];
    }

    return {
      ...result,

      appVersion: PACKAGE_VERSION,
      appName: PACKAGE_NAME,
      sessionId: this._sessionId,
      component: occurredAt.solution,
      activity: occurredAt.activity,
      projectPubkey: this._config.pubkey,
      userAgent: navigator.userAgent,
      eventType: result.eventType,
      eventTimestamp: occurredAt.timestamp,

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

    if (this._excludedEvents(body.eventType)) {
      return;
    }

    // Stamped now, formatted when the event is actually sent — see `_formattingPayload`.
    const occurredAt: EventContext = {
      timestamp: this._timestamp,
      activity: this._activity,
      solution: this._solution,
    };

    const enqueue = () => {
      this._queue.add(async () => {
        const payload = this._formattingPayload(
          { eventType: body.eventType, payload: body.payload, config: body.config },
          occurredAt,
        );

        if (this._lastPayload && this._checkObj(this._lastPayload, payload)) {
          return;
        }

        this._lastPayload = payload;
        if (body.eventType === InternalEventType.INIT_SOLUTION) {
          this._initialized = true;
        }
        await this._telemetryInstance.sendEvent(payload);
      });
    };

    if (body.eventType === InternalEventType.INIT_SOLUTION) {
      // A solution block inits before <uc-config> has published its attributes, so the config this event exists to
      // report is only complete once the current task ends. Everything else waits on `_initialized`, so nothing is
      // sent ahead of it.
      setTimeout(enqueue);
      return;
    }

    enqueue();
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
    if (!this._ctx.has('*solution')) {
      return null;
    }
    const solution = this._ctx.read('*solution');
    return solution ? solution.toLowerCase() : null;
  }

  private get _activity(): string | null {
    if (!this._ctx.has('*currentActivity')) {
      return null;
    }
    return this._ctx.read('*currentActivity');
  }

  private get _location(): string {
    return location.origin;
  }
}
