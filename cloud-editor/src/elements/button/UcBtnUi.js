import { BlockComponent } from '@uploadcare/upload-blocks';
import { classNames } from '../../lib/classNames.js';

export class UcBtnUi extends BlockComponent {
  constructor() {
    super();

    this._iconReversed = false;
    this._iconSingle = false;
    this._iconHidden = false;

    this.init$ = {
      text: '',
      icon: '',
      iconCss: this._iconCss(),
      theme: null,
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
    return classNames('icon', {
      icon_left: !this._iconReversed,
      icon_right: this._iconReversed,
      icon_hidden: this._iconHidden,
      icon_single: this._iconSingle,
    });
  }

  initCallback() {
    super.initCallback();

    this.sub(
      'icon',
      (iconName) => {
        this._iconSingle = !this.$.text;
        this._iconHidden = !iconName;
        this.$.iconCss = this._iconCss();
      },
      undefined,
      true
    );

    this.sub('theme', (theme) => {
      if (theme !== 'custom') {
        this.className = theme;
      }
    });

    this.sub('text', (txt) => {
      this._iconSingle = false;
    });

    this.setAttribute('role', 'button');
    if (this.tabIndex === -1) {
      this.tabIndex = 0;
    }
    if (!this.hasAttribute('theme')) {
      this.setAttribute('theme', 'default');
    }
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
UcBtnUi.bindAttributes({ text: 'text', icon: 'icon', reverse: 'reverse', theme: 'theme' });

UcBtnUi.template = /*html*/ `
<uc-icon size="20" set="className: iconCss; @name: icon;"></uc-icon>
<div class="text">{{text}}</div>
`;
