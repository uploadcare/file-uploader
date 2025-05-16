//@ts-check
import { TelemetryAPIService } from '@uploadcare/quality-insights';
import { PACKAGE_VERSION, PACKAGE_NAME } from '../../env.js';
import { initialConfig } from '../../blocks/Config/initialConfig.js';
import { throttle } from '../../blocks/utils/throttle.js';

/**
 * @typedef {{
 *   eventType?: Parameters<import('../../blocks/UploadCtxProvider/EventEmitter.js').EventEmitter['emit']>[0] | null;
 *   activity: import('../ActivityBlock.js').ActivityType;
 *   projectPubkey: import('../../types/index.js').ConfigType['pubkey'];
 *   appVersion: string;
 *   appName: string;
 *   sessionId: ReturnType<Crypto['randomUUID']>;
 *   component: 'uc-img' | 'uc-file-uploader-regular' | 'uc-file-uploader-minimal' | 'uc-file-uploader-inline';
 *   userAgent: string;
 *   config: import('../../types/index.js').ConfigType;
 *   payload: Record<string, unknown> | null;
 * }} TelemetryState
 */

export class TelemetryManager {
  /** @type {ReturnType<Crypto['randomUUID']>} */
  #sessionId = crypto.randomUUID();

  /** @type {TelemetryAPIService | null} */
  #telemetryInstance = null;

  /** @type {import('../Block.js').Block | null} */
  #block = null;

  /** @type {TelemetryState | null} */
  #lastPayload = null;

  #config = initialConfig;

  /** @param {import('../Block.js').Block} block */
  constructor(block) {
    this.#block = block;

    this.#telemetryInstance = new TelemetryAPIService();

    for (const key of /** @type {(keyof import('../../types/exported').ConfigType)[]} */ (Object.keys(initialConfig))) {
      block.subConfigValue(key, (value) => {
        this.#setConfig(key, value);
      });
    }
  }

  /**
   * @param {TelemetryState | null} prev
   * @param {TelemetryState} current
   * @returns {boolean}
   */
  #checkSendingSameProperties(prev, current) {
    if (!prev || !current) {
      return true;
    }

    try {
      const prevString = JSON.stringify(prev);
      const currentString = JSON.stringify(current);
      return prevString !== currentString;
    } catch (error) {
      console.error('Error comparing telemetry properties:', error);
      return true;
    }
  }

  /**
   * @template {keyof import('../../types').ConfigType} T
   * @param {T} key
   * @param {import('../../types').ConfigType[T]} value
   */
  #setConfig(key, value) {
    if (this.#config[key] === value) {
      return;
    }

    this.#config[key] = value;
  }

  /**
   * - @param {Pick<TelemetryState, 'eventType' | 'payload'> } body
   * - @returns {TelemetryState}
   */
  #formatingPayload(body) {
    if (body.payload?.activity) delete body['payload']['activity'];

    return {
      appVersion: PACKAGE_VERSION,
      appName: PACKAGE_NAME,
      sessionId: this.#sessionId,
      component: this.#solution,
      activity: this.#activity,
      projectPubkey: this.#config?.pubkey,
      userAgent: navigator.userAgent,
      eventType: body.eventType ?? null,
      config: this.#config,
      payload: {
        ...body.payload,
      },
    };
  }

  /**
   * @param {Pick<TelemetryState, 'eventType' | 'payload'> & {
   *   modalId?: string;
   *   eventType?: Parameters<import('../../blocks/UploadCtxProvider/EventEmitter.js').EventEmitter['emit']>[0];
   * }} body
   */
  sendEvent(body) {
    const payload = this.#formatingPayload(body);
    // const isDifferent = this.#checkSendingSameProperties(this.#lastPayload, payload);

    // if (!isDifferent) {
    //   return;
    // }

    this.#lastPayload = payload;
    this.#telemetryInstance?.sendEvent(payload);
  }

  get #solution() {
    return this.#block?.has('*solution') ? this.#block?.$['*solution'].toLowerCase() : null;
  }

  get #activity() {
    return this.#block?.has('*currentActivity') ? this.#block?.$['*currentActivity'] : null;
  }
}
