// @ts-check

import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import { type EventPayload, EventType } from './EventEmitter';

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: This is intentional interface merging, used to add event listener types
export class UploadCtxProvider extends LitUploaderBlock {
  public declare propertiesMeta: {
    'ctx-name': string;
  };
  public static override styleAttrs = ['uc-wgt-common'];
  public static EventType = EventType;

  private _unbindEventEmitter: (() => void) | null = null;

  public override initCallback() {
    super.initCallback();

    this._unbindEventEmitter = this.eventEmitter.bindTarget(this);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();

    this._unbindEventEmitter?.();
  }
}

type EventListenerMap = {
  [K in (typeof EventType)[keyof typeof EventType]]: (e: CustomEvent<EventPayload[K]>) => void;
};

export interface UploadCtxProvider extends LitUploaderBlock {
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

declare global {
  interface HTMLElementTagNameMap {
    'uc-upload-ctx-provider': UploadCtxProvider;
  }
}
