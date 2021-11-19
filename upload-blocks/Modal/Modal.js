import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { strokesCssBg } from '../svg-backgrounds/svg-backgrounds.js';

export class Modal extends BlockComponent {
  init$ = {
    caption: '',
    '*modalIcon': 'default',
    '*modalActive': false,
    '*modalCaption': 'Modal caption',
    '*modalHeaderHidden': false,
    '*modalDesiredWidth': '100%',
    '*modalDesiredHeight': '100%',
    '*modalDesiredMobileWidth': '100%',
    '*modalDesiredMobileHeight': '100%',

    closeClicked: () => {
      this.$['*modalActive'] = false;
    },
  };

  initCallback() {
    this.sub('*modalActive', (val) => {
      val ? this.setAttribute('active', '') : this.removeAttribute('active');
    });
    this.sub('*modalDesiredWidth', (val) => {
      this.style.setProperty('--modal-desired-w', val);
    });
    this.sub('*modalDesiredHeight', (val) => {
      this.style.setProperty('--modal-desired-h', val);
    });
    this.sub('*modalDesiredMobileWidth', (val) => {
      this.style.setProperty('--modal-desired-mobile-w', val);
    });
    this.sub('*modalDesiredMobileHeight', (val) => {
      this.style.setProperty('--modal-desired-mobile-h', val);
    });
    if (this.hasAttribute('strokes')) {
      this.style.backgroundImage = `url(${strokesCssBg()})`;
    }
  }
}

Modal.template = /*html*/ `
<div .dialog>
  <div .heading set="@hidden: *modalHeaderHidden">
    <uc-icon set="@name: *modalIcon"></uc-icon>
    <div
      .caption
      set="textContent: caption, *modalCaption">
    </div>
    <button
      .close-btn
      set="onclick: closeClicked">
      <uc-icon name="close"></uc-icon>
    </button>
  </div>
  <div .content>
    <slot></slot>
  </div>
</div>
`;
