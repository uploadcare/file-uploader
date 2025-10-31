import type { TelemetryRequest } from '@uploadcare/quality-insights';
import { TelemetryAPIService } from '@uploadcare/quality-insights';
import { Queue } from '@uploadcare/upload-client';
import { initialConfig } from '../../blocks/Config/initialConfig';
import type { EventKey, InternalEventKey } from '../../blocks/UploadCtxProvider/EventEmitter';
import { EventType, InternalEventType } from '../../blocks/UploadCtxProvider/EventEmitter';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../env';
import type { ConfigType } from '../../types/index';
import type { Block } from '../Block';

type CommonEventType = InternalEventKey | EventKey;

type TelemetryState = TelemetryRequest & { eventTimestamp: number };
type TelemetryEventBody = Partial<Pick<TelemetryState, 'payload' | 'config'>> & {
  modalId?: string;
  eventType?: CommonEventType;
};

export class TelemetryManager {
  private readonly _sessionId: string = crypto.randomUUID();
  private readonly _telemetryInstance: TelemetryAPIService;
  private readonly _block: Block;
  private _config: ConfigType = structuredClone(initialConfig);
  private _initialized = false;
  private _lastPayload: TelemetryState | null = null;
  private readonly _queue: Queue;

  constructor(block: Block) {
    this._block = block;
    this._telemetryInstance = new TelemetryAPIService();
    this._queue = new Queue(10);

    for (const key of Object.keys(this._config) as (keyof ConfigType)[]) {
      this._block.subConfigValue(key, (value) => {
        if (this._initialized && this._config[key] !== value) {
          this.sendEvent({
            eventType: InternalEventType.CHANGE_CONFIG,
          });
        }

        this._setConfig(key, value);
      });
    }
  }

  private _init(type: CommonEventType | undefined): void {
    if (type === InternalEventType.INIT_SOLUTION && !this._initialized) {
      this._initialized = true;
    }
  }

  private _setConfig<T extends keyof ConfigType>(key: T, value: ConfigType[T]): void {
    if (this._config[key] === value) {
      return;
    }

    this._config[key] = value;
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
      activity: this._activity,
      projectPubkey: this._config.pubkey,
      userAgent: navigator.userAgent,
      eventType: result.eventType ?? '',
      eventTimestamp: this._timestamp,

      payload: {
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

  sendEvent(body: TelemetryEventBody): void {
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

  sendEventError(error: unknown, context = 'unknown'): void {
    this.sendEvent({
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
  sendEventCloudImageEditor(e: MouseEvent, tabId: string, options: Record<string, unknown> = {}): void {
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
    if (!this._block.has('*solution')) {
      return null;
    }
    const solution = this._block.$['*solution'] as string | undefined;
    return solution ? solution.toLowerCase() : null;
  }

  private get _activity(): string | null {
    if (!this._block.has('*currentActivity')) {
      return null;
    }
    return (this._block.$['*currentActivity'] as string | undefined) ?? null;
  }
}
