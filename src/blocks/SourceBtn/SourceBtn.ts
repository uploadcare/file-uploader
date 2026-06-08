import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import '../../blocks/SourceBtn/source-btn.css';
import '../Icon/Icon';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';

export interface SourceButtonConfig {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void | Promise<void>;
}

/**
 * v2 `<uc-source-btn>`. Renders a single source row (icon + localized
 * label) and forwards click to `source.onClick`. v1's `source-btn.css`
 * styles the tag directly so visuals are inherited.
 */
export class SourceBtn extends ChildBlock {
  @property({ attribute: false })
  public source?: SourceButtonConfig;

  /** Renders only the icon (no label). Used by SmartBtn's inline mode. */
  @property({ type: Boolean })
  public iconOnly = false;

  @state()
  private _iconName = 'default';

  @state()
  private _labelKey = '';

  protected override subscriptionsFor(ctrl: UploaderController) {
    // Re-render on locale or icon-registry changes.
    return [ctrl.locale.subscribe.bind(ctrl.locale), ctrl.plugins.subscribe.bind(ctrl.plugins)];
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate?.(changed);
    if (changed.has('source')) {
      this._iconName = this.source?.icon ?? this.source?.id ?? 'default';
      this._labelKey = this.source?.label ?? '';
    }
  }

  private _activate = (): void => {
    if (!this.source) return;
    void this.source.onClick();
  };

  public override render() {
    const label = this._labelKey ? (this.uploaderOrNull?.locale.t(this._labelKey) ?? this._labelKey) : '';
    return html`
      <button type="button" @click=${this._activate}>
        <uc-icon name=${this._iconName}></uc-icon>
        ${this.iconOnly ? '' : html`<div class="uc-txt">${label}</div>`}
      </button>
    `;
  }
}

if (!customElements.get('uc-source-btn')) customElements.define('uc-source-btn', SourceBtn);
