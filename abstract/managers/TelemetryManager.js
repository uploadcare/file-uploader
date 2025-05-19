// @ts-check
import { TelemetryAPIService } from '@uploadcare/quality-insights';

import { Queue } from '@uploadcare/upload-client';
import { PACKAGE_VERSION, PACKAGE_NAME } from '../../env.js';
import { initialConfig } from '../../blocks/Config/initialConfig.js';
import { EventType } from '../../blocks/UploadCtxProvider/EventEmitter.js';

/** @typedef {import('@uploadcare/quality-insights').TelemetryRequest & { eventTimestamp: number }} TelemetryState */

export class TelemetryManager {
  /** @type {ReturnType<Crypto['randomUUID']>} */
  _sessionId = crypto.randomUUID();

  /** @type {TelemetryAPIService | null} */
  _telemetryInstance = null;

  /** @type {import('../Block.js').Block | null} */
  _block = null;

  _config = initialConfig;

  /** @type {boolean} */
  _initialized = false;

  /** @type {TelemetryState | null} */
  _lastPayload = null;

  /** @type {import('@uploadcare/upload-client').Queue | null} */
  _queue = null;

  /** @param {import('../Block.js').Block} block */
  constructor(block) {
    this._block = block;

    this._telemetryInstance = new TelemetryAPIService();

    this._queue = new Queue(10);

    for (const key of /** @type {(keyof import('../../types/exported').ConfigType)[]} */ (Object.keys(initialConfig))) {
      block.subConfigValue(key, (value) => {
        if (this._initialized && this._config[key] !== value) {
          this._block?.emit(EventType.CHANGE_CONFIG, undefined);
        }

        this._setConfig(key, value);
      });
    }
  }

  /** @param {keyof import('../../blocks/UploadCtxProvider/EventEmitter.js').EventPayload | undefined} type */
  _init(type) {
    if (type === EventType.INIT_SOLUTION && !this._initialized) {
      this._initialized = true;
    }
  }

  /**
   * @template {keyof import('../../types').ConfigType} T
   * @param {T} key
   * @param {import('../../types').ConfigType[T]} value
   */
  _setConfig(key, value) {
    if (this._config[key] === value) {
      return;
    }

    this._config[key] = value;
  }

  /**
   * @param {Pick<TelemetryState, 'eventType' | 'payload' | 'config'>} body
   * @returns {TelemetryState}
   */
  _formattingPayload(body) {
    const payload = body.payload ? { ...body.payload } : {};
    if (payload.activity) payload.activity = undefined;

    const result = { ...body };
    if (body.eventType === EventType.INIT_SOLUTION || body.eventType === EventType.CHANGE_CONFIG) {
      result.config = this._config;
    }

    return {
      ...result,

      appVersion: PACKAGE_VERSION,
      appName: PACKAGE_NAME,
      sessionId: this._sessionId,
      component: this._solution,
      activity: this._activity,
      projectPubkey: this._config?.pubkey,
      userAgent: navigator.userAgent,
      eventType: result.eventType ?? '',
      eventTimestamp: this._timestamp,

      payload: {
        ...payload,
      },
    };
  }

  /** @param {keyof import('../../blocks/UploadCtxProvider/EventEmitter.js').EventPayload | undefined} type */
  _excludedEvents(type) {
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
        EventType.FILE_URL_CHANGED,
        EventType.GROUP_CREATED,
      ].includes(type)
    ) {
      return true;
    }

    return false;
  }

  /**
   * @param {Partial<Pick<TelemetryState, 'eventType' | 'payload'>> & {
   *   modalId?: string;
   *   eventType?: keyof import('../../blocks/UploadCtxProvider/EventEmitter.js').EventPayload;
   * }} body
   */
  sendEvent(body) {
    const payload = this._formattingPayload(
      /** @type {Pick<TelemetryState, 'eventType' | 'payload' | 'config'>} */ (body),
    );

    this._init(body.eventType);

    const hasExcludedEvents = this._excludedEvents(body.eventType);
    if (hasExcludedEvents) return null;

    const hasDataSame = this._lastPayload && this._checkObj(this._lastPayload, payload);
    if (hasDataSame) return null;

    this._queue?.add(async () => {
      this._lastPayload = payload;
      await this._telemetryInstance?.sendEvent(/** @type {TelemetryState} */ (payload));
    });
  }

  /**
   * Method to send telemetry event for Cloud Image Editor.
   *
   * @param {MouseEvent} e
   * @param {string} tabId
   * @param {Record<string, unknown>} options
   */
  sendEventCloudImageEditor(e, tabId, options = {}) {
    this.sendEvent({
      payload: {
        metadata: {
          tabId,
          node: /** @type {HTMLElement} */ (e.currentTarget)?.tagName,
          event: e.type,
          ...options,
        },
      },
    });
  }

  /**
   * Deeply compares two objects and returns true if they are equal, false otherwise.
   *
   * @param {any} last
   * @param {any} current
   */
  _checkObj(last, current) {
    if (JSON.stringify(last) === JSON.stringify(current)) return true;
    if (typeof last !== 'object' || typeof current !== 'object' || last == null || current == null) return false;
    const lastKeys = Object.keys(last);
    const currentKeys = Object.keys(current);
    if (lastKeys.length !== currentKeys.length) return false;
    for (const key of lastKeys) {
      if (!Object.prototype.hasOwnProperty.call(current, key)) return false;
      if (!this._checkObj(last[key], current[key])) return false;
    }

    return true;
  }

  get _timestamp() {
    return Date.now();
  }

  get _solution() {
    return this._block?.has('*solution') ? this._block?.$['*solution'].toLowerCase() : null;
  }

  get _activity() {
    return this._block?.has('*currentActivity') ? this._block?.$['*currentActivity'] : null;
  }
}
