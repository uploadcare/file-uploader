import { applyElementStyles } from '../../symbiote/core/css_utils.js';
import { setAriaClick } from '../../symbiote/core/render_utils.js';
import { ucIconHtml } from './icons/ucIconHtml.js';
import { AppComponent } from './AppComponent.js';

const STYLES = {
  ':host': {
    '--l-base-min-width': '40px',
    '--l-base-height': 'var(--l-base-min-width)',

    '--opacity-effect': 'var(--idle-opacity)',
    '--color-effect': 'var(--idle-color-rgb)',
    '--filter-effect': 'var(--idle-filter)',

    '--idle-color-rgb': 'var(--rgb-text-base)',
    '--idle-opacity': '0.05',
    '--idle-filter': '1',

    '--hover-color-rgb': 'var(--idle-color-rgb)',
    '--hover-opacity': '0.08',
    '--hover-filter': '0.8',

    '--down-color-rgb': 'var(--hover-color-rgb)',
    '--down-opacity': '0.12',
    '--down-filter': '0.6',

    outline: 'none',
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: 'var(--l-base-min-width) auto',
    alignItems: 'center',
    cursor: 'pointer',
    height: 'var(--l-base-height)',
    transition: 'var(--l-width-transition)',
    color: 'rgba(var(--idle-color-rgb))',
  },
  active: {
    '--idle-color-rgb': 'var(--rgb-primary-accent)',
  },
  not_active: {
    '--idle-color-rgb': 'var(--rgb-text-base)',
  },
  before: {
    zIndex: '-1',
    position: 'absolute',
    width: '100%',
    height: '100%',
    left: '0px',
    right: '0px',
    transition: 'var(--transition-duration-3)',
    backgroundColor: 'rgba(var(--color-effect), var(--opacity-effect))',
    borderRadius: 'var(--border-radius-editor)',
  },
  icon: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textTransform: 'uppercase',
    paddingRight: 'var(--gap-mid-1)',
    letterSpacing: '1.004px',
    fontSize: '0.7em',
  },
};

export class EditorButtonControl extends AppComponent {
  constructor() {
    super();

    this._iconName = null;
    this._title = null;

    this.state = {
      active: false,
      title: '',
      icon: '',
      'tpl.icon': '',
      'on.click': null,
    };
  }

  readyCallback() {
    super.readyCallback();

    this._titleEl = this.ref('title-el');
    this._iconEl = this.ref('icon-el');

    this.setAttribute('role', 'button');
    if (this.tabIndex === -1) {
      this.tabIndex = 0;
    }

    this.sub('icon', (icon) => {
      if (icon) {
        this.state['tpl.icon'] = ucIconHtml(icon);
      }
    });

    this.sub('title', (title) => {
      let titleEl = this._titleEl;
      if (titleEl) {
        this._titleEl.style.display = title ? 'block' : 'none';
      }
    });

    this.sub('active', (active) => {
      applyElementStyles(this, STYLES[active ? 'active' : 'not_active']);
    });

    this.sub('on.click', (onClick) => {
      setAriaClick(this, onClick);
    });
  }
}

EditorButtonControl.renderShadow = false;
EditorButtonControl.styles = STYLES;

EditorButtonControl.template = /*html*/ `
  <div css="before"></div>
  <div css="icon" set="innerHTML: tpl.icon"></div>
  <div css="title" ref="title-el" set="textContent: title"></div>
`;
