import { classNames } from './lib/classNames.js';
import { Block } from '../../../abstract/Block.js';

export class EditorButtonControl extends Block {
  init$ = {
    ...this.init$,
    active: false,
    title: '',
    icon: '',
    'on.click': null,
  };

  initCallback() {
    super.initCallback();

    this._titleEl = this.ref['title-el'];
    this._iconEl = this.ref['icon-el'];

    if (this.firstElementChild.tabIndex === -1) {
      this.firstElementChild.tabIndex = 0;
    }

    this.sub('title', (title) => {
      let titleEl = this._titleEl;
      if (titleEl) {
        this._titleEl.style.display = title ? 'block' : 'none';
      }
    });

    this.sub('active', (active) => {
      this.className = classNames({
        active: active,
        not_active: !active,
      });
    });

    this.sub('on.click', (onClick) => {
      this.onclick = onClick;
    });
  }
}

EditorButtonControl.template = /* HTML */ `
  <button role="option" tabindex="0">
    <lr-icon set="@name: icon;"></lr-icon>
    <div class="title" ref="title-el">{{title}}</div>
  </button>
`;
