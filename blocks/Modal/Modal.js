import { Block } from '../../abstract/Block.js';

export class Modal extends Block {
  _handleClose = () => {
    if (this.$['*modalCloseCallback']) {
      this.$['*modalCloseCallback']();
      return;
    }
    this.set$({
      '*modalActive': false,
      '*currentActivity': '',
    });
  };

  _handleClick = (e) => {
    if (e.target === this.ref.dialog) {
      this._handleClose();
    }
  };
  init$ = {
    ...this.ctxInit,
    '*modalActive': false,
    '*modalHeaderHidden': false,
    '*modalCloseCallback': null,
    isOpen: false,
    closeClicked: this._handleClose,
  };

  cssInit$ = {
    '--cfg-modal-backdrop-strokes': 0,
  };

  show() {
    if (this.ref.dialog.showModal) {
      this.ref.dialog.showModal();
    } else {
      this.setAttribute('dialog-fallback', '');
    }
  }

  hide() {
    if (this.ref.dialog.close) {
      this.ref.dialog.close();
    } else {
      this.removeAttribute('dialog-fallback');
    }
  }

  initCallback() {
    super.initCallback();
    this.ref.dialog.addEventListener('close', this._handleClose);
    this.ref.dialog.addEventListener('click', this._handleClick);
    this.sub('*modalActive', (modalActive) => {
      if (this.$.isOpen !== modalActive) {
        this.$.isOpen = modalActive;
      }

      if (modalActive && this.getCssData('--cfg-modal-scroll-lock')) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = null;
      }
    });

    this.sub('--cfg-modal-backdrop-strokes', (val) => {
      if (val) {
        this.setAttribute('strokes', '');
      } else {
        this.removeAttribute('strokes');
      }
    });

    this.sub('isOpen', (isOpen) => {
      if (isOpen) {
        this.show();
        this.ref.dialog.setAttribute('open', '');
      } else {
        this.hide();
        this.ref.dialog.removeAttribute('open');
      }
    });
  }

  destroyCallback() {
    super.destroyCallback();
    this.ref.dialog.removeEventListener('close', this._handleClose);
    this.ref.dialog.removeEventListener('click', this._handleClick);
  }
}

Modal.template = /* HTML */ `
  <dialog ref="dialog" class="dialog">
    <div class="heading" set="@hidden: *modalHeaderHidden">
      <slot name="heading"></slot>
      <button type="button" class="close-btn" set="onclick: closeClicked">
        <lr-icon name="close"></lr-icon>
      </button>
    </div>
    <div class="content">
      <slot></slot>
    </div>
  </dialog>
`;
