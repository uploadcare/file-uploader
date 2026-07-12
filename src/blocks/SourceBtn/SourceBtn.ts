import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { ChildBlock } from '../../lit/ChildBlock';
import './source-btn.css';

import '../Icon/Icon';
import { InternalEventType } from '../UploadCtxProvider/EventEmitter';

export type SourceButtonConfig = {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void | Promise<void>;
};

export class SourceBtn extends ChildBlock {
  @property({ attribute: false })
  public source?: SourceButtonConfig;

  @property({ type: Boolean })
  public textOnly = false;

  @property({ type: Boolean })
  public iconOnly = false;

  @state()
  private _iconName = 'default';

  @state()
  private _srcTypeKey = '';

  protected override controllerReady(): void {
    // A `source` set while the render gate was closed never reaches
    // `willUpdate` (Lit clears changed-properties for gated cycles) —
    // re-derive from the current value on adoption.
    this._applySource(this.source);
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('source')) {
      this._applySource(this.source);
    }
  }

  private _applySource(source?: SourceButtonConfig): void {
    if (!source) {
      this._srcTypeKey = '';
      this._iconName = 'default';
      return;
    }

    const { label, icon, id } = source;
    this._srcTypeKey = label;
    this._iconName = icon ?? id ?? 'default';
  }

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [(listener: () => void) => ctrl.locale.subscribe(listener)];
  }

  public activate(): void {
    if (!this.source) return;

    this.bag.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        sourceId: this.source.id,
      },
    });

    void this.source.onClick();
  }

  public override render() {
    return html`
      <button aria-label=${this.l10n(this._srcTypeKey)} type="button" @click=${this.activate}>
        ${this.textOnly ? '' : html`<uc-icon name=${this._iconName}></uc-icon>`}
        ${this.iconOnly ? '' : html`<div class="uc-txt">${this.l10n(this._srcTypeKey)}</div>`}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-source-btn': SourceBtn;
  }
}
