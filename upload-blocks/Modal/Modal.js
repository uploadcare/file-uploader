import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { strokesCssBg } from '../svg-backgrounds/svg-backgrounds.js';

export class Modal extends BlockComponent {
  init$ = {
    '*modalActive': false,
    '*modalHeaderHidden': false,
    // '*modalDesiredWidth': '100%',
    // '*modalDesiredHeight': '100%',
    // '*modalDesiredMobileWidth': '100%',
    // '*modalDesiredMobileHeight': '100%',

    closeClicked: () => {
      this.$['*currentActivity'] = '';
    },
  };

  initCallback() {
    this.sub('*currentActivity', (val) => {
      this.set$({
        '*modalActive': !!val,
      });
    });
    this.sub('*uploadList', (list) => {
      if (!list.length && this.$['*modalActive']) {
        this.$['*currentActivity'] = BlockComponent.activities.SOURCE_SELECT;
      }
    });
    this.sub('*modalActive', (val) => {
      val ? this.setAttribute('active', '') : this.removeAttribute('active');
    });
    // this.sub('*modalDesiredWidth', (val) => {
    //   this.style.setProperty('--modal-desired-w', val);
    // });
    // this.sub('*modalDesiredHeight', (val) => {
    //   this.style.setProperty('--modal-desired-h', val);
    // });
    // this.sub('*modalDesiredMobileWidth', (val) => {
    //   this.style.setProperty('--modal-desired-mobile-w', val);
    // });
    // this.sub('*modalDesiredMobileHeight', (val) => {
    //   this.style.setProperty('--modal-desired-mobile-h', val);
    // });
    if (this.hasAttribute('strokes')) {
      this.style.backgroundImage = `url(${strokesCssBg()})`;
    }
  }
}

Modal.template = /*html*/ `
<div .dialog>
  <div .heading set="@hidden: *modalHeaderHidden">
    <uc-activity-icon></uc-activity-icon>
    <uc-activity-caption></uc-activity-caption>
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
