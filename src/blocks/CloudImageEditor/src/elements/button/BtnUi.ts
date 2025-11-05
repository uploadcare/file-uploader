import { html } from '@symbiotejs/symbiote';
import { Block } from '../../../../../abstract/Block';
import { classNames } from '../../lib/classNames';

type Theme = string | null;

export class BtnUi extends Block {
  private _iconReversed = false;
  private _iconSingle = false;
  private _iconHidden = false;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      text: '',
      icon: '',
      iconCss: this._iconCss(),
      theme: null as Theme,
      'aria-role': '',
      'aria-controls': '',
      'title-prop': '',
    };

    this.defineAccessor('active', (active: boolean) => {
      if (active) {
        this.setAttribute('active', '');
      } else {
        this.removeAttribute('active');
      }
    });
  }

  private _iconCss(): string {
    return classNames('uc-icon', {
      'uc-icon_left': !this._iconReversed,
      'uc-icon_right': this._iconReversed,
      'uc-icon_hidden': this._iconHidden,
      'uc-icon_single': this._iconSingle,
    });
  }

  override initCallback(): void {
    super.initCallback();

    this.sub('icon', (iconName: string) => {
      this._iconSingle = !this.$.text;
      this._iconHidden = !iconName;
      this.$.iconCss = this._iconCss();
    });

    this.sub('theme', (theme: Theme) => {
      if (theme && theme !== 'custom') {
        this.className = `uc-${theme}`;
      }
    });

    this.sub('text', () => {
      this._iconSingle = false;
    });

    if (!this.hasAttribute('theme')) {
      this.setAttribute('theme', 'default');
    }

    this.defineAccessor('aria-role', (value: string | null) => {
      this.$['aria-role'] = value || '';
    });

    this.defineAccessor('aria-controls', (value: string | null) => {
      this.$['aria-controls'] = value || '';
    });

    this.defineAccessor('title-prop', (value: string | null) => {
      this.$['title-prop'] = value || '';
    });
  }

  set reverse(_value: boolean) {
    if (this.hasAttribute('reverse')) {
      this.style.flexDirection = 'row-reverse';
      this._iconReversed = true;
    } else {
      this._iconReversed = false;
      this.style.flexDirection = '';
    }
  }
}

BtnUi.bindAttributes({ text: 'text', icon: 'icon', reverse: 'reverse', theme: 'theme' });

BtnUi.template = html`
  <button
    type="button"
    bind="@role:aria-role; @aria-controls: aria-controls; @aria-label:title-prop"
    l10n="@title:title-prop;"
  >
    <uc-icon bind="className: iconCss; @name: icon; @hidden: !icon"></uc-icon>
    <div class="uc-text">{{text}}</div>
  </button>
`;
