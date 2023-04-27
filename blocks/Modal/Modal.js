import { Block } from '../../abstract/Block.js';

export class Modal extends Block {
  static StateConsumerScope = 'modal';

  _handleBackdropClick = () => {
    this._closeDialog();
  };

  _closeDialog = () => {
    this.setForCtxTarget(Modal.StateConsumerScope, '*modalActive', false);
  };

  _handleDialogClose = () => {
    this._closeDialog();
  };

  _handleDialogClick = (e) => {
    if (e.target === this.ref.dialog) {
      this._closeDialog();
    }
  };

  init$ = {
    ...this.ctxInit,
    '*modalActive': false,
    isOpen: false,
    closeClicked: this._handleDialogClose,
  };

  cssInit$ = {
    '--cfg-modal-backdrop-strokes': 0,
  };

  show() {
    if (this.ref.dialog.showModal) {
      this.ref.dialog.showModal();
    } else {
      this.ref.dialog.setAttribute('open', '');
    }
  }

  hide() {
    if (this.ref.dialog.close) {
      this.ref.dialog.close();
    } else {
      this.ref.dialog.removeAttribute('open');
    }
  }

  initCallback() {
    super.initCallback();
    if (typeof HTMLDialogElement === 'function') {
      this.ref.dialog.addEventListener('close', this._handleDialogClose);
      this.ref.dialog.addEventListener('click', this._handleDialogClick);
    } else {
      this.setAttribute('dialog-fallback', '');
      let backdrop = document.createElement('div');
      backdrop.className = 'backdrop';
      this.appendChild(backdrop);
      backdrop.addEventListener('click', this._handleBackdropClick);
    }

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
      } else {
        this.hide();
      }
    });
  }

  destroyCallback() {
    super.destroyCallback();
    document.body.style.overflow = null;
    this.ref.dialog.removeEventListener('close', this._handleDialogClose);
    this.ref.dialog.removeEventListener('click', this._handleDialogClick);
  }
}

Modal.template = /* HTML */ `
  <dialog ref="dialog">
    <slot></slot>
  </dialog>
`;
