import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { AriaRole } from '../../../../../types/dom';
import { EditorBlock } from '../../editor-context';
import type { EditorL10nKey } from '../../editor-locale';
import '../../EditorIcon';

type Theme = string | null;

export class BtnUi extends EditorBlock {
  @property({ type: String })
  public text = '';

  @property({ type: String })
  public icon = '';

  @property({ type: Boolean, reflect: true })
  public reverse = false;

  @property({ type: String, reflect: true })
  public theme: Theme = 'default';

  @property({ attribute: 'aria-role' })
  public ariaRole: AriaRole | undefined = undefined;

  @property({ attribute: 'aria-controls' })
  public ariaControls = '';

  /** `aria-selected` of the inner button, for `aria-role="tab"`; unset renders none. */
  @property({ type: Boolean, attribute: false })
  public selected: boolean | undefined = undefined;

  @property({ attribute: 'title-prop' })
  public titleProp: EditorL10nKey | '' = '';

  protected override firstUpdated(changed: PropertyValues<this>): void {
    super.firstUpdated(changed);
    this._applyReverse();
    this._applyThemeClass();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);

    if (changed.has('reverse')) {
      this._applyReverse();
    }

    if (changed.has('theme')) {
      this._applyThemeClass(changed.get('theme'));
    }
  }

  private _applyReverse(): void {
    this.style.flexDirection = this.reverse ? 'row-reverse' : '';
  }

  private _applyThemeClass(previous?: Theme): void {
    if (previous) {
      this.classList.remove(`uc-${previous}`);
    }
    if (this.theme && this.theme !== 'custom') {
      this.classList.add(`uc-${this.theme}`);
    }
  }

  private get _iconClassMap(): Record<string, boolean> {
    const iconHidden = this._computedIconHidden;
    return {
      'uc-icon': true,
      'uc-icon_left': !this.reverse,
      'uc-icon_right': this.reverse,
      'uc-icon_hidden': iconHidden,
      'uc-icon_single': this._computedIconSingle,
    };
  }

  private get _computedIconHidden(): boolean {
    return !this.icon;
  }

  private get _computedIconSingle(): boolean {
    return !this.text && !this._computedIconHidden;
  }

  private get _ariaSelected(): 'true' | 'false' | undefined {
    if (this.selected === undefined) return undefined;
    return this.selected ? 'true' : 'false';
  }

  public override render() {
    return html`
      <button
        type="button"
        role=${ifDefined(this.ariaRole || undefined)}
        aria-controls=${ifDefined(this.ariaControls || undefined)}
        aria-selected=${ifDefined(this._ariaSelected)}
        aria-label=${ifDefined(this.titleProp ? this.l10nSafe(this.titleProp) : undefined)}
        title=${ifDefined(this.titleProp ? this.l10nSafe(this.titleProp) : undefined)}
      >
        <uc-editor-icon
          class=${classMap(this._iconClassMap)}
          name=${ifDefined(this.icon || undefined)}
          ?hidden=${this._computedIconHidden}
        ></uc-editor-icon>
        <div class="uc-text">${this.text}</div>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-btn-ui': BtnUi;
  }
}
