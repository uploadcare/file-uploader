import { html } from '@symbiotejs/symbiote';
import { Block } from '../../abstract/Block';
import type { ModalCb, ModalId } from '../../abstract/managers/ModalManager';
import { ModalEvents } from '../../abstract/managers/ModalManager';
import { EventType } from '../UploadCtxProvider/EventEmitter';
import './modal.css';

let LAST_ACTIVE_MODAL_ID: ModalId | null = null;

export class Modal extends Block {
  static override styleAttrs = [...super.styleAttrs, 'uc-modal'];
  static override StateConsumerScope = 'modal';

  private _mouseDownTarget: EventTarget | null | undefined;

  handleModalOpen!: ModalCb;
  handleModalClose!: ModalCb;
  handleModalCloseAll!: ModalCb;

  constructor() {
    super();
    this.init$ = {
      ...this.init$,
      closeClicked: this._handleDialogClose,
    };
  }

  _handleBackdropClick = (): void => {
    this._closeDialog();
  };

  _closeDialog = (): void => {
    this.modalManager?.close(this.id);

    if (!this.modalManager?.hasActiveModals) {
      document.body.style.overflow = '';
    }
  };

  _handleDialogClose = (): void => {
    this._closeDialog();
  };

  _handleDialogMouseDown = (e: MouseEvent): void => {
    this._mouseDownTarget = e.target;
  };

  _handleDialogMouseUp = (e: MouseEvent): void => {
    const target = e.target as EventTarget | null;
    if (target === this.ref.dialog && target === this._mouseDownTarget) {
      this._closeDialog();
    }
  };

  show(): void {
    const dialog = this.ref.dialog as HTMLDialogElement & {
      showModal?: () => void;
    };
    if (typeof dialog.showModal === 'function') {
      this.setAttribute('aria-modal', 'true');
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    if (this.cfg.modalScrollLock) {
      document.body.style.overflow = 'hidden';
    }
  }

  hide(): void {
    const dialog = this.ref.dialog as HTMLDialogElement & {
      close?: () => void;
    };
    if (typeof dialog.close === 'function') {
      this.setAttribute('aria-modal', 'false');
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  private _handleModalOpen({ id }: Parameters<ModalCb>[0]): void {
    if (id === this.id) {
      LAST_ACTIVE_MODAL_ID = id;
      this.show();
      this.emit(EventType.MODAL_OPEN, { modalId: id }, { debounce: true });
    } else {
      this.hide();
    }
  }

  private _handleModalClose({ id }: Parameters<ModalCb>[0]): void {
    if (id === this.id) {
      this.hide();
      this.emit(
        EventType.MODAL_CLOSE,
        { modalId: id, hasActiveModals: this.modalManager?.hasActiveModals },
        { debounce: true },
      );
    }
  }

  private _handleModalCloseAll(_data: Parameters<ModalCb>[0]): void {
    this.hide();

    if (LAST_ACTIVE_MODAL_ID === this.id) {
      this.emit(
        EventType.MODAL_CLOSE,
        { modalId: LAST_ACTIVE_MODAL_ID, hasActiveModals: this.modalManager?.hasActiveModals },
        { debounce: true },
      );
    }
  }

  override initCallback(): void {
    super.initCallback();

    this.modalManager?.registerModal(this.id, this);

    const dialog = this.ref.dialog as HTMLDialogElement;
    dialog.addEventListener('close', this._handleDialogClose);
    dialog.addEventListener('mousedown', this._handleDialogMouseDown);
    dialog.addEventListener('mouseup', this._handleDialogMouseUp);

    this.subConfigValue('modalBackdropStrokes', (val: boolean) => {
      if (val) {
        this.setAttribute('strokes', '');
      } else {
        this.removeAttribute('strokes');
      }
    });

    this.handleModalOpen = this._handleModalOpen.bind(this);
    this.handleModalClose = this._handleModalClose.bind(this);
    this.handleModalCloseAll = this._handleModalCloseAll.bind(this);

    this.modalManager?.subscribe(ModalEvents.OPEN, this.handleModalOpen);
    this.modalManager?.subscribe(ModalEvents.CLOSE, this.handleModalClose);
    this.modalManager?.subscribe(ModalEvents.CLOSE_ALL, this.handleModalCloseAll);
  }

  override destroyCallback(): void {
    super.destroyCallback();
    document.body.style.overflow = '';
    this._mouseDownTarget = undefined;
    const dialog = this.ref.dialog as HTMLDialogElement;
    dialog.removeEventListener('close', this._handleDialogClose);
    dialog.removeEventListener('mousedown', this._handleDialogMouseDown);
    dialog.removeEventListener('mouseup', this._handleDialogMouseUp);

    this.modalManager?.unsubscribe(ModalEvents.OPEN, this.handleModalOpen);
    this.modalManager?.unsubscribe(ModalEvents.CLOSE, this.handleModalClose);
    this.modalManager?.unsubscribe(ModalEvents.CLOSE_ALL, this.handleModalCloseAll);
  }
}

Modal.template = html`
  <dialog ref="dialog">
    <slot></slot>
  </dialog>
`;
