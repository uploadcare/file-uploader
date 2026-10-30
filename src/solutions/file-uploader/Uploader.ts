import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import type { ApiHostEventListenerMap } from '../../lit/api-host-types';
import { booleanAttribute } from '../../lit/boolean-attribute';
import { ChildBlock } from '../../lit/ChildBlock';
import type { ConfigHostAttributesMeta } from '../../lit/config-host-types';
import { WithApi } from '../../lit/WithApi';
import { WithConfig } from '../../lit/WithConfig';
import { UID } from '../../utils/UID';

import './regular/FileUploaderRegular';
import './minimal/FileUploaderMinimal';
import './inline/FileUploaderInline';

/** Solution layout selected by the host's `mode` attribute. */
export type UploaderMode = 'regular' | 'minimal' | 'inline';

/**
 * Unified host that combines the three tags users used to compose by hand:
 *
 * - **config** — {@link WithConfig} (same attrs/props as `<uc-config>`)
 * - **public API + events** — {@link WithApi} (same surface as `<uc-upload-ctx-provider>`)
 * - **solution UI** — renders `<uc-file-uploader-regular|minimal|inline>` under
 *   this host, selected by the `mode` attribute
 *
 * ```html
 * <uc-uploader mode="regular" pubkey="demopublickey"></uc-uploader>
 * ```
 *
 * Existing multi-tag compositions stay supported; this is additive.
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: intentional interface merge for typed event listeners
export class Uploader extends WithConfig(WithApi(ChildBlock)) {
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

  /** Which solution layout to render underneath. */
  @property({ reflect: true })
  public mode: UploaderMode = 'regular';

  /** Regular-only: hide the open button (modal-only composition). */
  @property({ converter: booleanAttribute })
  public headless = false;

  /** Regular-only: use `<uc-dynamic-btn>` instead of `<uc-simple-btn>`. */
  @property({ attribute: 'dynamic-button', converter: booleanAttribute })
  public dynamicButton = false;

  private _mintedCtxName: string | undefined = undefined;

  public override connectedCallback(): void {
    // Single-tag convenience: if the user never set `ctx-name`, mint one so the
    // host + nested solution share a private ctx without boilerplate.
    if (!this.ctxName && !this.hasAttribute('ctx-name')) {
      this._mintedCtxName = `uc-uploader-${UID.generateRandomUUID().slice(0, 8)}`;
      this.setAttribute('ctx-name', this._mintedCtxName);
    }
    super.connectedCallback();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    // A `ctxName` property replaced the minted name: Lit restores one set
    // before upgrade only in the first update, after `connectedCallback`
    // minted. Point the attribute at the real ctx instead of the minted one.
    const minted = this._mintedCtxName;
    if (minted && this.ctxName && this.ctxName !== minted && this.getAttribute('ctx-name') === minted) {
      this._mintedCtxName = undefined;
      this.setAttribute('ctx-name', this.ctxName);
    }
  }

  public override render() {
    // Nested solutions inherit `ctx-name` via ChildBlock's ContextProvider —
    // no need to re-set the attribute on the child.
    if (this.mode === 'minimal') {
      return html`<uc-file-uploader-minimal></uc-file-uploader-minimal>`;
    }
    if (this.mode === 'inline') {
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

export interface Uploader extends ChildBlock {
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
    'uc-uploader': Uploader;
  }
}
