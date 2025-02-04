import { Block } from '../../../../../abstract/Block.js';
import { classNames } from '../../lib/classNames.js';

export class BtnUi extends Block {
  constructor() {
    super();

    this._iconReversed = false;
    this._iconSingle = false;
    this._iconHidden = false;

    this.init$ = {
      ...this.init$,
      text: '',
      icon: '',
      iconCss: this._iconCss(),
      theme: null,
      'aria-role': '',
      'aria-controls': '',
      'title-prop': '',
    };

    this.defineAccessor('active', (active) => {
      if (active) {
        this.setAttribute('active', '');
      } else {
        this.removeAttribute('active');
      }
    });
  }

  _iconCss() {
    return classNames('uc-icon', {
      'uc-icon_left': !this._iconReversed,
      'uc-icon_right': this._iconReversed,
      'uc-icon_hidden': this._iconHidden,
      'uc-icon_single': this._iconSingle,
    });
  }

  initCallback() {
    super.initCallback();

    this.sub('icon', (iconName) => {
      this._iconSingle = !this.$.text;
      this._iconHidden = !iconName;
      this.$.iconCss = this._iconCss();
    });

    this.sub('theme', (theme) => {
      if (theme !== 'custom') {
        this.className = `uc-${theme}`;
      }
    });

    this.sub('text', (txt) => {
      this._iconSingle = false;
    });

    if (!this.hasAttribute('theme')) {
      this.setAttribute('theme', 'default');
    }

    this.defineAccessor('aria-role', (value) => {
      this.$['aria-role'] = value || '';
    });

    this.defineAccessor('aria-controls', (value) => {
      this.$['aria-controls'] = value || '';
    });

    this.defineAccessor('title-prop', (value) => {
      this.$['title-prop'] = value || '';
    });
  }

  set reverse(val) {
    if (this.hasAttribute('reverse')) {
      this.style.flexDirection = 'row-reverse';
      this._iconReversed = true;
    } else {
      this._iconReversed = false;
      this.style.flexDirection = null;
    }
  }
}

BtnUi.bindAttributes({ text: 'text', icon: 'icon', reverse: 'reverse', theme: 'theme' });

BtnUi.template = /* HTML */ `
  <button
    type="button"
    set="@role:aria-role; @aria-controls: aria-controls; @aria-label:title-prop"
    l10n="@title:title-prop;"
  >
    <uc-icon set="className: iconCss; @name: icon; @hidden: !icon"></uc-icon>
    <div class="uc-text">{{text}}</div>
  </button>
`;
