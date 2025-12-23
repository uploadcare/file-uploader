import { property } from 'lit/decorators.js';
import { LitBlock } from '../../../../../lit/LitBlock';
import { applyClassNames } from '../../lib/classNames';

type PresenceToggleStyle = {
  transition?: string;
  visible?: string;
  hidden?: string;
};

const DEFAULT_STYLE: Required<PresenceToggleStyle> = {
  transition: 'uc-transition',
  visible: 'uc-visible',
  hidden: 'uc-hidden',
};

export class PresenceToggle extends LitBlock {
  private _visible = false;
  private _styles: PresenceToggleStyle = DEFAULT_STYLE;
  private _visibleStyle: string = DEFAULT_STYLE.visible;
  private _hiddenStyle: string = DEFAULT_STYLE.hidden;
  private _externalTransitions = false;
  private _initialRenderComplete = false;

  @property({ type: Boolean })
  public set visible(value: boolean) {
    this._visible = value;
    this._handleVisible();
  }

  public get visible(): boolean {
    return this._visible;
  }

  @property({ attribute: false })
  public set styles(styles: PresenceToggleStyle) {
    this._styles = styles;
    this._externalTransitions = true;
    this._visibleStyle = styles.visible ?? DEFAULT_STYLE.visible;
    this._hiddenStyle = styles.hidden ?? DEFAULT_STYLE.hidden;
  }
  public get styles(): PresenceToggleStyle {
    return this._styles;
  }

  private _handleVisible(): void {
    this.style.visibility = this._visible ? 'inherit' : 'hidden';
    applyClassNames(this, {
      [DEFAULT_STYLE.transition]: !this._externalTransitions,
      [this._visibleStyle]: this._visible,
      [this._hiddenStyle]: !this._visible,
    });
    this.toggleAttribute('inert', !this._visible);
  }

  private _dispatchInitialRenderEvent(): void {
    if (this._initialRenderComplete) {
      return;
    }

    this._initialRenderComplete = true;
    this.dispatchEvent(
      new CustomEvent('initial-render', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  public override initCallback(): void {
    super.initCallback();

    this.classList.toggle('uc-initial', true);

    if (!this._externalTransitions) {
      this.classList.add(DEFAULT_STYLE.transition);
    }

    this._handleVisible();
    setTimeout(() => {
      this.classList.toggle('uc-initial', false);
      this._dispatchInitialRenderEvent();
    }, 0);
  }
}
