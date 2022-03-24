import { BlockComponent } from '@uploadcare/upload-blocks';
import { classNames } from './lib/classNames.js';

export class EditorButtonControl extends BlockComponent {
  init$ = {
    active: false,
    title: '',
    icon: '',
    'on.click': null,
  };

  initCallback() {
    super.initCallback();

    this._titleEl = this.ref['title-el'];
    this._iconEl = this.ref['icon-el'];

    this.setAttribute('role', 'button');
    if (this.tabIndex === -1) {
      this.tabIndex = 0;
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

EditorButtonControl.template = /*html*/ `
  <div class="before"></div>
  <uc-icon size="20" set="@name: icon;"></uc-icon>
  <div class="title" ref="title-el">{{title}}</div>
`;
