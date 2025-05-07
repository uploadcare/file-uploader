// @ts-check
import { Block } from '../../abstract/Block.js';
import { ModalEvents } from '../../abstract/ModalManager.js';
import { EventType } from '../UploadCtxProvider/EventEmitter.js';

/** @type {import('../../abstract/ModalManager.js').ModalId | null} */
let LAST_ACTIVE_MODAL_ID = null;

export class Modal extends Block {
  static styleAttrs = [...super.styleAttrs, 'uc-modal'];
  static StateConsumerScope = 'modal';

  constructor() {
    super();
    this.init$ = {
      ...this.init$,
      closeClicked: this._handleDialogClose,
    };
  }

  _handleBackdropClick = () => {
    this._closeDialog();
  };

  _closeDialog = () => {
    this.modalManager?.close(this.id);

    if (!this.modalManager.hasActiveModals) {
      document.body.style.overflow = '';
    }
  };

  _handleDialogClose = () => {
    this._closeDialog();
  };

  /** @param {Event} e */
  _handleDialogMouseDown = (e) => {
    /** @private */
    this._mouseDownTarget = e.target;
  };

  /** @param {Event} e */
  _handleDialogMouseUp = (e) => {
    if (e.target === this.ref.dialog && e.target === this._mouseDownTarget) {
      this._closeDialog();
    }
  };

  show() {
    if (this.ref.dialog.showModal) {
      this.setAttribute('aria-modal', 'true');
      this.ref.dialog.showModal();
    } else {
      this.ref.dialog.setAttribute('open', '');
    }

    if (this.cfg.modalScrollLock) {
      document.body.style.overflow = 'hidden';
    }
  }

  hide() {
    if (this.ref.dialog.close) {
      this.setAttribute('aria-modal', 'false');
      this.ref.dialog.close();
    } else {
      this.ref.dialog.removeAttribute('open');
    }
  }

  /**
   * @private
   * @type {import('../../abstract/ModalManager.js').ModalCb}
   */
  _handleModalOpen({ id }) {
    if (id === this.id) {
      LAST_ACTIVE_MODAL_ID = id;
      this.show();
    } else {
      this.hide();
    }

    this.emit(EventType.MODAL_OPEN, { modalId: id }, { debounce: true });
  }

  /**
   * @private
   * @type {import('../../abstract/ModalManager.js').ModalCb}
   */
  _handleModalClose({ id }) {
    if (id === this.id) {
      this.hide();
    }

    this.emit(
      EventType.MODAL_CLOSE,
      { modalId: id, hasActiveModals: this.modalManager.hasActiveModals },
      { debounce: true },
    );
  }

  /** @private */
  _handleModalCloseAll() {
    this.hide();

    if (LAST_ACTIVE_MODAL_ID === this.id) {
      this.emit(
        EventType.MODAL_CLOSE,
        { modalId: LAST_ACTIVE_MODAL_ID, hasActiveModals: this.modalManager.hasActiveModals },
        { debounce: true },
      );
    }
  }

  initCallback() {
    super.initCallback();

    this.modalManager?.registerModal(this.id, this);

    this.ref.dialog.addEventListener('close', this._handleDialogClose);
    this.ref.dialog.addEventListener('mousedown', this._handleDialogMouseDown);
    this.ref.dialog.addEventListener('mouseup', this._handleDialogMouseUp);

    this.subConfigValue('modalBackdropStrokes', (val) => {
      if (val) {
        this.setAttribute('strokes', '');
      } else {
        this.removeAttribute('strokes');
      }
    });

    this.handleModalOpen = this._handleModalOpen.bind(this);
    this.handleModalClose = this._handleModalClose.bind(this);
    this.handleModalCloseAll = this._handleModalCloseAll.bind(this);

    this.modalManager.subscribe(ModalEvents.OPEN, this.handleModalOpen);
    this.modalManager.subscribe(ModalEvents.CLOSE, this.handleModalClose);
    this.modalManager.subscribe(ModalEvents.CLOSE_ALL, this.handleModalCloseAll);
  }

  destroyCallback() {
    super.destroyCallback();
    document.body.style.overflow = '';
    this._mouseDownTarget = undefined;
    this.ref.dialog.removeEventListener('close', this._handleDialogClose);
    this.ref.dialog.removeEventListener('mousedown', this._handleDialogMouseDown);
    this.ref.dialog.removeEventListener('mouseup', this._handleDialogMouseUp);

    this.modalManager.unsubscribe(ModalEvents.OPEN, this.handleModalOpen);
    this.modalManager.unsubscribe(ModalEvents.CLOSE, this.handleModalClose);
    this.modalManager.unsubscribe(ModalEvents.CLOSE_ALL, this.handleModalCloseAll);
  }
}

Modal.template = /* HTML */ `
  <dialog ref="dialog">
    <slot></slot>
  </dialog>
`;
