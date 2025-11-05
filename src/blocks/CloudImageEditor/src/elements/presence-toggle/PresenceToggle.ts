import { html } from '@symbiotejs/symbiote';
import { Block } from '../../../../../abstract/Block';
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

export class PresenceToggle extends Block {
  private _visible = false;
  private _visibleStyle: string = DEFAULT_STYLE.visible;
  private _hiddenStyle: string = DEFAULT_STYLE.hidden;
  private _externalTransitions = false;

  constructor() {
    super();

    this.defineAccessor('styles', (styles?: PresenceToggleStyle) => {
      if (!styles) {
        return;
      }
      this._externalTransitions = true;
      this._visibleStyle = styles.visible ?? DEFAULT_STYLE.visible;
      this._hiddenStyle = styles.hidden ?? DEFAULT_STYLE.hidden;
    });

    this.defineAccessor('visible', (visible?: boolean) => {
      if (typeof visible !== 'boolean') {
        return;
      }

      this._visible = visible;
      this._handleVisible();
    });
  }

  private _handleVisible(): void {
    this.style.visibility = this._visible ? 'inherit' : 'hidden';
    applyClassNames(this, {
      [DEFAULT_STYLE.transition]: !this._externalTransitions,
      [this._visibleStyle]: this._visible,
      [this._hiddenStyle]: !this._visible,
    });
    this.setAttribute('aria-hidden', this._visible ? 'false' : 'true');
  }

  override initCallback(): void {
    super.initCallback();

    this.classList.toggle('uc-initial', true);

    if (!this._externalTransitions) {
      this.classList.add(DEFAULT_STYLE.transition);
    }

    this._handleVisible();
    setTimeout(() => {
      this.classList.toggle('uc-initial', false);
    }, 0);
  }
}
PresenceToggle.template = html`<slot></slot> `;
