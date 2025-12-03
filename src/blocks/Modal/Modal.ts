import { html } from 'lit';
import type { ModalCb, ModalId } from '../../abstract/managers/ModalManager';
import { ModalEvents } from '../../abstract/managers/ModalManager';
import { LitBlock } from '../../lit/LitBlock';
import { EventType } from '../UploadCtxProvider/EventEmitter';
import './modal.css';
import { createRef, ref } from 'lit/directives/ref.js';

let LAST_ACTIVE_MODAL_ID: ModalId | null = null;

export class Modal extends LitBlock {
  static override styleAttrs = [...super.styleAttrs, 'uc-modal'];

  private _mouseDownTarget: EventTarget | null | undefined;
  protected dialogEl = createRef<HTMLDialogElement>();

  handleModalOpen!: ModalCb;
  handleModalClose!: ModalCb;
  handleModalCloseAll!: ModalCb;

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
    if (target === this.dialogEl.value && target === this._mouseDownTarget) {
      this._closeDialog();
    }
  };

  show(): void {
    const dialog = this.dialogEl.value as HTMLDialogElement & {
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
    const dialog = this.dialogEl.value as HTMLDialogElement & {
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

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.body.style.overflow = '';
    this._mouseDownTarget = undefined;

    this.modalManager?.unsubscribe(ModalEvents.OPEN, this.handleModalOpen);
    this.modalManager?.unsubscribe(ModalEvents.CLOSE, this.handleModalClose);
    this.modalManager?.unsubscribe(ModalEvents.CLOSE_ALL, this.handleModalCloseAll);
  }

  private handleDialogRef(dialog: Element | undefined): void {
    this.dialogEl = { value: dialog } as typeof this.dialogEl;

    this.dialogEl.value?.addEventListener('close', this._handleDialogClose);
    this.dialogEl.value?.addEventListener('mousedown', this._handleDialogMouseDown);
    this.dialogEl.value?.addEventListener('mouseup', this._handleDialogMouseUp);
  }

  override render() {
    return html`
  <dialog ${ref(this.handleDialogRef)}>
    ${this.yield('')}
  </dialog>
`;
  }
}
