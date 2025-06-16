// @ts-check

import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { EventType } from './EventEmitter.js';
class UploadCtxProviderClass extends UploaderBlock {
  static styleAttrs = ['uc-wgt-common'];
  requireCtxName = true;

  initCallback() {
    super.initCallback();

    this.$['*eventEmitter'].bindTarget(this);
  }

  destroyCallback() {
    super.destroyCallback();

    this.$['*eventEmitter'].unbindTarget(this);
  }
}

UploadCtxProviderClass.EventType = EventType;

/**
 * @typedef {import('../../utils/mixinClass.js').MixinClass<
 *   typeof UploadCtxProviderClass,
 *   {
 *     addEventListener<
 *       T extends (typeof import('./EventEmitter.js').EventType)[keyof typeof import('./EventEmitter.js').EventType],
 *     >(
 *       type: T,
 *       listener: (e: CustomEvent<import('./EventEmitter.js').EventPayload[T]>) => void,
 *       options?: boolean | AddEventListenerOptions,
 *     ): void;
 *     removeEventListener<
 *       T extends (typeof import('./EventEmitter.js').EventType)[keyof typeof import('./EventEmitter.js').EventType],
 *     >(
 *       type: T,
 *       listener: (e: CustomEvent<import('./EventEmitter.js').EventPayload[T]>) => void,
 *       options?: boolean | EventListenerOptions,
 *     ): void;
 *   }
 * >} UploadCtxProvider
 */

export const UploadCtxProvider = /** @type {UploadCtxProvider} */ (/** @type {unknown} */ (UploadCtxProviderClass));
