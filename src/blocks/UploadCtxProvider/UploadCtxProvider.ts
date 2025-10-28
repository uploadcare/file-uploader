// @ts-check

import { UploaderBlock } from '../../abstract/UploaderBlock';
import { type EventPayload, EventType } from './EventEmitter';

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: This is intentional interface merging, used to add event listener types
export class UploadCtxProvider extends UploaderBlock {
  static override styleAttrs = ['uc-wgt-common'];
  static EventType = EventType;

  override requireCtxName = true;

  override initCallback() {
    super.initCallback();

    this.$['*eventEmitter'].bindTarget(this);
  }

  override destroyCallback() {
    super.destroyCallback();

    this.$['*eventEmitter'].unbindTarget(this);
  }
}

type EventListenerMap = {
  [K in (typeof EventType)[keyof typeof EventType]]: (e: CustomEvent<EventPayload[K]>) => void;
};

export interface UploadCtxProvider extends UploaderBlock {
  addEventListener<T extends keyof EventListenerMap>(
    type: T,
    listener: EventListenerMap[T],
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<T extends keyof EventListenerMap>(
    type: T,
    listener: EventListenerMap[T],
    options?: boolean | EventListenerOptions,
  ): void;
}
