import { AppComponent } from '../../AppComponent.js';
import { ucIconHtml } from '../../icons/ucIconHtml.js';
import { classNames } from '../../lib/classNames.js';

export class UcBtnUi extends AppComponent {
  constructor() {
    super();

    this._iconReversed = false;
    this._iconSingle = false;
    this._iconHidden = false;

    this.state = {
      text: '',
      icon: '',
      iconCss: this._iconCss(),
      theme: null,
    };

    // TODO: active should be moved out of here
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

  readyCallback() {
    super.readyCallback();

    this.sub(
      'icon',
      (iconName) => {
        if (iconName) {
          this['icon-el'].innerHTML = ucIconHtml(iconName);
        }

        this._iconSingle = !this.state.text;
        this._iconHidden = !iconName;
        this.state.iconCss = this._iconCss();
      },
      undefined,
      true
    );

    this.setAttribute('role', 'button');
    if (this.tabIndex === -1) {
      this.tabIndex = 0;
    }
    if (!this.hasAttribute('theme')) {
      this.setAttribute('theme', 'default');
    }
  }

  set text(txt) {
    this._iconSingle = false;
    this.state.text = txt;
  }

  set icon(icon) {
    this.state.icon = icon;
  }

  set theme(theme) {
    if (theme !== 'custom') {
      this.className = theme;
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
UcBtnUi.observeAttributes(['text', 'icon', 'reverse', 'theme']);

UcBtnUi.template = /*html*/ `
<div ref="icon-el" set="class: iconCss"></div>
<div class="text" set="textContent: text"></div>
`;

UcBtnUi.is = 'uc-btn-ui';
