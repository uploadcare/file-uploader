import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { inject } from '../../abstract/di/inject';
import { InternalEventType } from '../../abstract/EventEmitter';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { booleanAttribute } from '../../lit/boolean-attribute';
import { ChildBlock } from '../../lit/ChildBlock';
import type { AriaRole } from '../../types/dom';
import './source-btn.css';

import '../Icon/Icon';
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

  public activate(): void {
    if (!this.source) return;

    this._telemetry.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: { event: 'select-source', node: this.tagName, sourceId: this.source.id },
        // Backward compatibility: telemetry consumers read `source_id` at the payload root, where it was sent before
        // it moved into `metadata` like every other action event's detail.
        // NEXT-MAJOR(telemetry): drop the root `sourceId`. Kept for 1.x compat.
        sourceId: this.source.id,
      },
    });

    const { source } = this;
    this.runTask(() => source.onClick());
  }

  public override render() {
    const { source } = this;
    const label = this.pluginLabel(source?.label);
    return html`
      <button
        aria-label=${label}
        role=${ifDefined(this.buttonRole)}
        type="button"
        @click=${this.activate}
      >
        ${this.textOnly ? '' : html`<uc-icon name=${source?.icon ?? source?.id ?? 'default'}></uc-icon>`}
        ${this.iconOnly ? '' : html`<div class="uc-txt">${label}</div>`}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-source-btn': SourceBtn;
  }
}
