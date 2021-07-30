import { AppComponent } from '../../AppComponent.js';
import { ucIconHtml } from '../../icons/ucIconHtml.js';
import { applyElementStyles } from '../../../../symbiote/core/css_utils.js';
import { cssTokens } from '../../lib/cssTokens.js';

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
    return cssTokens('icon', {
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
      applyElementStyles(this, UcBtnUi.styles[theme]);
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

// This component using "hover" and "focus" rules from common.css
// [tabindex] selector is used for --opacity-effect change
UcBtnUi.styles = {
  ':host': {
    '--filter-effect': 'var(--idle-brightness)',
    '--opacity-effect': 'var(--idle-opacity)',
    '--color-effect': 'var(--idle-color-rgb)',
    '--l-transition-effect':
      'var(--css-transition, color var(--transition-duration-2), filter var(--transition-duration-2))',

    display: 'inline-flex',
    alignItems: 'center',
    height: 'var(--css-height, var(--size-touch-area))',
    paddingRight: 'var(--css-padding-right, var(--gap-mid-1))',
    paddingLeft: 'var(--css-padding-left, var(--gap-mid-1))',
    color: 'rgba(var(--color-effect), var(--opacity-effect))',
    filter: 'brightness(var(--filter-effect))',
    cursor: 'pointer',
    userSelect: 'none',
    outline: 'none',
    boxSizing: 'var(--css-box-sizing, border-box)',
    transition: 'var(--l-transition-effect)',
  },
  text: {
    whiteSpace: 'nowrap',
  },
  icon: {
    color: 'rgba(var(--color-effect), var(--opacity-effect))',
    filter: 'brightness(var(--filter-effect))',
    transition: 'var(--l-transition-effect)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon_left: {
    marginLeft: '0px',
    marginRight: 'var(--gap-mid-1)',
  },
  icon_right: {
    marginLeft: 'var(--gap-mid-1)',
    marginRight: '0px',
  },
  icon_single: {
    marginLeft: '0px',
    marginRight: '0px',
  },
  icon_hidden: {
    margin: 0,
    display: 'none',
  },
  primary: {
    '--idle-color-rgb': 'var(--rgb-primary-accent)',
    '--idle-brightness': '1',
    '--idle-opacity': '0.6',

    '--hover-color-rgb': 'var(--idle-color-rgb)',
    '--hover-brightness': '1',
    '--hover-opacity': '1',

    '--down-color-rgb': 'var(--hover-color-rgb)',
    '--down-brightness': '0.75',
    '--down-opacity': '1',

    '--active-color-rgb': 'var(--rgb-primary-accent)',
    '--active-brightness': '1',
    '--active-opacity': '1',
  },
  boring: {
    '--idle-color-rgb': 'var(--rgb-text-base)',
    '--idle-brightness': '1',
    '--idle-opacity': '0.6',

    '--hover-color-rgb': 'var(--rgb-text-base)',
    '--hover-brightness': '1',
    '--hover-opacity': '1',

    '--down-color-rgb': 'var(--hover-color-rgb)',
    '--down-brightness': '1',
    '--down-opacity': '1',

    '--active-color-rgb': 'var(--rgb-primary-accent)',
    '--active-brightness': '1',
    '--active-opacity': '1',
  },
  default: {
    '--idle-color-rgb': 'var(--rgb-text-base)',
    '--idle-brightness': '1',
    '--idle-opacity': '0.6',

    '--hover-color-rgb': 'var(--rgb-primary-accent)',
    '--hover-brightness': '1',
    '--hover-opacity': '1',

    '--down-color-rgb': 'var(--hover-color-rgb)',
    '--down-brightness': '0.75',
    '--down-opacity': '1',

    '--active-color-rgb': 'var(--rgb-primary-accent)',
    '--active-brightness': '1',
    '--active-opacity': '1',
  },
};
UcBtnUi.template = /*html*/ `
<div css ref="icon-el" set="css: iconCss"></div>
<div css="text" set="textContent: text"></div>
`;
