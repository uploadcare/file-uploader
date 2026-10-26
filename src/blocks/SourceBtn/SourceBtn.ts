import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { inject } from '../../abstract/di/inject';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { booleanAttribute } from '../../lit/boolean-attribute';
import { ChildBlock } from '../../lit/ChildBlock';
import type { AriaRole } from '../../types/dom';
import './source-btn.css';

import '../Icon/Icon';
import { InternalEventType } from '../../abstract/EventEmitter';
import type { PluginLabel } from '../../abstract/managers/plugin/PluginTypes';
import type { SourceButtonConfig } from '../../abstract/sources';

export type { SourceButtonConfig };

export class SourceBtn extends ChildBlock {
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;

  @property({ attribute: false })
  public source?: SourceButtonConfig;

  /** Role for the inner `<button>`, the element that takes focus (e.g. `menuitem` inside a menu). */
  @property({ attribute: false })
  public buttonRole?: AriaRole;

  @property({ converter: booleanAttribute })
  public textOnly = false;

  @property({ converter: booleanAttribute })
  public iconOnly = false;

  @state()
  private _iconName = 'default';

  @state()
  private _srcTypeKey: PluginLabel | '' = '';

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

  public activate(): void {
    if (!this.source) return;

    this._telemetry.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        sourceId: this.source.id,
      },
    });

    const { source } = this;
    this.runTask(() => source.onClick());
  }

  public override render() {
    return html`
      <button
        aria-label=${this._srcTypeKey ? this.l10n(this._srcTypeKey) : ''}
        role=${ifDefined(this.buttonRole)}
        type="button"
        @click=${this.activate}
      >
        ${this.textOnly ? '' : html`<uc-icon name=${this._iconName}></uc-icon>`}
        ${this.iconOnly ? '' : html`<div class="uc-txt">${this._srcTypeKey ? this.l10n(this._srcTypeKey) : ''}</div>`}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-source-btn': SourceBtn;
  }
}
