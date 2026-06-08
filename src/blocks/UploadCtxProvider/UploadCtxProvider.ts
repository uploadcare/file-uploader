import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { type UploaderEventPayload, UploaderEventType } from '../../abstract/EventBus';
import type { UploaderApi } from '../../abstract/UploaderApi';
import { bindEventBusToElement } from '../../abstract/ui-adapters';

/**
 * v1-compat shim for `<uc-upload-ctx-provider>`.
 *
 * Originally a `LitUploaderBlock` that hosted the shared upload context.
 * In v2 the upload context lives on `<uc-uploader>` (resolved via
 * `UploaderRegistry` keyed by `ctx-name`); this element is now a thin
 * adapter that exposes the v1 surface — `.api`, `.getAPI()`,
 * `.uploadCollection`, and DOM event dispatch — backed by the v2
 * `UploaderController`.
 *
 * **Required**: a sibling `<uc-uploader*>` element with the same
 * `ctx-name` attribute must exist somewhere in the document. Without
 * one, `.api` throws — matching v1's behaviour when the context
 * provider couldn't find its owner.
 *
 * @deprecated Place `<uc-uploader-regular>` (or other preset) directly;
 * its `.api` is the recommended surface. The provider element will be
 * removed in the next major version.
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: typed addEventListener overloads
export class UploadCtxProvider extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-wgt-common'];

  /** v1-compat: static enum of all event type strings. */
  public static EventType = UploaderEventType;

  private _unbindEventBus?: () => void;

  protected override controllerReady(ctrl: UploaderController): void {
    this._unbindEventBus?.();
    this._unbindEventBus = bindEventBusToElement(this, ctrl.events);
  }

  protected override controllerReleased(): void {
    this._unbindEventBus?.();
    this._unbindEventBus = undefined;
  }

  /** v2's public api facade. Carries v1 method aliases (initFlow, doneFlow, …). */
  public get api(): UploaderApi {
    return this.uploader.api;
  }

  /** @deprecated v1 alias for `api`. Use `element.api` instead. */
  public getAPI(): UploaderApi {
    return this.uploader.api;
  }

  /**
   * v1 surface — read-only view of the upload collection. Returns the v2
   * `UploadCollectionController`; method names happen to overlap (`size`,
   * `clearAll`, etc.). v1's `TypedCollection`-specific APIs (`findItems`,
   * `read`, `readProp`, `items()` as a method, `observeCollection`) are
   * not provided; consumers who need them should migrate to the
   * controller's `entries` getter and `subscribe()` method.
   *
   * @deprecated Use `element.api.getItems()` / `element.api.on('change', …)` instead.
   */
  public get uploadCollection() {
    return this.uploader.collection;
  }
}

type EventListenerMap = {
  [K in (typeof UploaderEventType)[keyof typeof UploaderEventType]]: (e: CustomEvent<UploaderEventPayload[K]>) => void;
};

export interface UploadCtxProvider extends ChildBlock {
  addEventListener<T extends keyof EventListenerMap>(
    type: T,
    listener: EventListenerMap[T],
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;

  removeEventListener<T extends keyof EventListenerMap>(
    type: T,
    listener: EventListenerMap[T],
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;
}

if (!customElements.get('uc-upload-ctx-provider')) {
  customElements.define('uc-upload-ctx-provider', UploadCtxProvider);
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-upload-ctx-provider': UploadCtxProvider;
  }
}
