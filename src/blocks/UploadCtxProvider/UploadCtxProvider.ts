import type { ApiHostEventListenerMap } from '../../lit/api-host-types';
import { ChildBlock } from '../../lit/ChildBlock';
import { WithApi } from '../../lit/WithApi';
import { EventType } from './EventEmitter';

/**
 * `<uc-upload-ctx-provider>` — thin API/events host. Behavior lives in the
 * reusable {@link WithApi} mixin (uploader-scope attach, `getAPI()` / `.api` /
 * `.uploadCollection`, EventBus → DOM CustomEvents) so any block can expose the
 * same surface. This element is just `WithApi(ChildBlock)` + styles + the
 * static `EventType` re-export kept for documented access paths.
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: intentional interface merge for typed event listeners
export class UploadCtxProvider extends WithApi(ChildBlock) {
  public static override styleAttrs = ['uc-wgt-common'];
  // Keep the public static on the element class for `UploadCtxProvider.EventType`
  // (also available on the WithApi mixin class as `EventType`).
  public static EventType = EventType;
}

export interface UploadCtxProvider extends ChildBlock {
  addEventListener<T extends keyof ApiHostEventListenerMap>(
    type: T,
    listener: ApiHostEventListenerMap[T],
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<T extends keyof ApiHostEventListenerMap>(
    type: T,
    listener: ApiHostEventListenerMap[T],
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-upload-ctx-provider': UploadCtxProvider;
  }
}
