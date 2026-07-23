import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import type { ControllerContainer } from '../../abstract/di/ControllerContainer';
import { inject } from '../../abstract/di/inject';
import { EventBus } from '../../abstract/EventBus';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import type { EventPayload, EventType } from '../../blocks/UploadCtxProvider/EventEmitter';
import { ChildBlock } from '../../lit/ChildBlock';
import type { ConfigHostAttributesMeta } from '../../lit/config-host-types';
import { ensureUploaderScope } from '../../lit/ensureUploaderScope';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import { WithConfig } from '../../lit/WithConfig';
import { UID } from '../../utils/UID';

import './regular/FileUploaderRegular';
import './minimal/FileUploaderMinimal';
import './inline/FileUploaderInline';

/** Solution layout selected by the host's `mode` attribute. */
export type UploaderMode = 'regular' | 'minimal' | 'inline';

const MODES: readonly UploaderMode[] = ['regular', 'minimal', 'inline'];

const isUploaderMode = (value: string): value is UploaderMode => (MODES as readonly string[]).includes(value);

/**
 * Unified host that combines the three tags users used to compose by hand:
 *
 * - **config** — `WithConfig` on this element (same attrs/props as `<uc-config>`)
 * - **public API + events** — `getAPI()` / `.api` and EventBus → DOM CustomEvents
 *   (same surface as `<uc-upload-ctx-provider>`)
 * - **solution UI** — renders `<uc-file-uploader-regular|minimal|inline>` under
 *   this host, selected by the `mode` attribute
 *
 * ```html
 * <uc-uploader mode="regular" pubkey="demopublickey"></uc-uploader>
 * ```
 *
 * Existing multi-tag compositions stay supported; this is additive.
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: intentional interface merge for typed event listeners (same pattern as UploadCtxProvider)
export class Uploader extends WithConfig(ChildBlock) {
  public static override styleAttrs = ['uc-wgt-common'];

  /**
   * JSX/attribute surface: config plain keys + `ctx-name` (from {@link WithConfig})
   * plus the unified-host controls.
   */
  public declare attributesMeta: ConfigHostAttributesMeta & {
    mode?: UploaderMode;
    headless?: boolean;
    'dynamic-button'?: boolean;
  };

  /**
   * Which solution layout to render underneath. Unknown values fall back to
   * `regular` with a console warn (once per change).
   */
  @property({ reflect: true })
  public mode: UploaderMode = 'regular';

  /** Regular-only: hide the open button (modal-only composition). */
  @property({ type: Boolean })
  public headless = false;

  /** Regular-only: use `<uc-dynamic-btn>` instead of `<uc-simple-btn>`. */
  @property({ attribute: 'dynamic-button', type: Boolean })
  public dynamicButton = false;

  @inject(EventBus) private readonly _eventBus!: EventBus;
  @inject(UploadCollectionController) private readonly _uploadCollection!: UploadCollectionController;
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  public override connectedCallback(): void {
    // Single-tag convenience: if the user never set `ctx-name`, mint one so the
    // host + nested solution share a private ctx without boilerplate.
    if (!this.ctxName && !this.hasAttribute('ctx-name')) {
      this.setAttribute('ctx-name', `uc-uploader-${UID.generateRandomUUID().slice(0, 8)}`);
    }
    super.connectedCallback();
  }

  protected override controllerReady(container: ControllerContainer): void {
    // WithConfig seeds config writers/attrs first; then attach the uploader
    // scope so `getAPI()` is ready on this host (UploadCtxProvider parity).
    super.controllerReady(container);
    ensureUploaderScope(container);
  }

  /**
   * Bridge the per-ctx {@link EventBus} to documented DOM `CustomEvent`s on this
   * host — same contract as `<uc-upload-ctx-provider>` so listeners can attach
   * to `<uc-uploader>` directly.
   */
  @subscription()
  protected _bridgeBusToDom(): Unsubscribe {
    return this._eventBus.onAny((type, payload) => {
      this.dispatchEvent(new CustomEvent(type, { detail: payload }));
    });
  }

  /** Same contract as `<uc-upload-ctx-provider>.getAPI()`. */
  public getAPI(): UploaderPublicApi {
    return this._api;
  }

  /** Same contract as `<uc-upload-ctx-provider>.api`. */
  public get api(): UploaderPublicApi {
    return this._api;
  }

  /** Same contract as `<uc-upload-ctx-provider>.uploadCollection`. */
  public get uploadCollection(): UploadCollectionController {
    return this._uploadCollection;
  }

  private _resolvedMode(): UploaderMode {
    if (isUploaderMode(this.mode)) return this.mode;
    this._log.warn(`Unknown mode "${this.mode}", falling back to "regular"`);
    return 'regular';
  }

  public override render() {
    const mode = this._resolvedMode();
    // Nested solutions inherit `ctx-name` via ChildBlock's ContextProvider —
    // no need to re-set the attribute on the child.
    if (mode === 'minimal') {
      return html`<uc-file-uploader-minimal></uc-file-uploader-minimal>`;
    }
    if (mode === 'inline') {
      return html`<uc-file-uploader-inline></uc-file-uploader-inline>`;
    }
    return html`
      <uc-file-uploader-regular
        ?headless=${this.headless}
        ?dynamic-button=${this.dynamicButton}
      ></uc-file-uploader-regular>
    `;
  }
}

type EventListenerMap = {
  [K in (typeof EventType)[keyof typeof EventType]]: (e: CustomEvent<EventPayload[K]>) => void;
};

export interface Uploader extends ChildBlock {
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

declare global {
  interface HTMLElementTagNameMap {
    'uc-uploader': Uploader;
  }
}
