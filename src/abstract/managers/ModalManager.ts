import type { Modal as ModalNode } from '../../blocks/Modal/Modal';
import type { ActivityType } from '../../lit/LitActivityBlock';
import type { LitBlock } from '../../lit/LitBlock';

export const ModalEvents = Object.freeze({
  ADD: 'modal:add',
  DELETE: 'modal:delete',
  OPEN: 'modal:open',
  CLOSE: 'modal:close',
  CLOSE_ALL: 'modal:closeAll',
  DESTROY: 'modal:destroy',
} as const);

export type ModalId = ActivityType;
export type ModalCb = (data: { id: ModalId; modal: ModalNode }) => void;
export type ModalEventType = (typeof ModalEvents)[keyof typeof ModalEvents];

export class ModalManager {
  private _modals: Map<ModalId, ModalNode> = new Map();
  private _activeModals: Set<ModalId> = new Set();
  private _subscribers: Map<ModalEventType, Set<ModalCb>> = new Map();
  private _block: LitBlock;

  public constructor(block: LitBlock) {
    this._block = block;
  }

  private _debugPrint(...args: unknown[]): void {
    this._block.debugPrint('[modal-manager]', ...args);
  }

  /**
   * Register a modal with the manager
   * @param id Unique identifier for the modal
   * @param modal Modal component instance
   */
  public registerModal(id: ModalId, modal: ModalNode): void {
    this._modals.set(id, modal);
    this._notify(ModalEvents.ADD, { id, modal });
  }

  /** Remove a modal by ID. */
  public deleteModal(id: ModalId): boolean {
    const modal = this._modals.get(id);
    if (!modal) return false;

    this._modals.delete(id);
    this._activeModals.delete(id);
    this._notify(ModalEvents.DELETE, { id, modal });
    return true;
  }

  /** Open a modal by its ID. */
  public open(id: ModalId): boolean {
    const modal = this._modals.get(id);
    if (!modal) {
      this._debugPrint(`Modal with ID "${id}" not found`);
      return false;
    }

    this._activeModals.add(id);
    this._notify(ModalEvents.OPEN, { modal, id });
    return true;
  }

  /** Close a specific modal by ID. */
  public close(id: ModalId): boolean {
    const modal = this._modals.get(id);
    if (!modal || !this._activeModals.has(id)) {
      this._debugPrint(`Modal with ID "${id}" not found or not active`);
      return false;
    }

    this._activeModals.delete(id);
    this._notify(ModalEvents.CLOSE, { id, modal });

    // TODO: Fire close-all event if no active modals remain?

    return true;
  }

  /** Toggle a modal - open if closed, close if open. */
  public toggle(id: ModalId): boolean {
    if (!this._modals.has(id)) {
      this._debugPrint(`Modal with ID "${id}" not found`);
      return false;
    }

    if (this._activeModals.has(id)) {
      return this.close(id);
    } else {
      return this.open(id);
    }
  }

  /** True if there are any active modals. */
  public get hasActiveModals(): boolean {
    return this._activeModals.size > 0;
  }

  /** Close the most recently opened modal and return to the previous one. */
  public back(): boolean {
    if (this._activeModals.size === 0) {
      this._debugPrint('No active modals to go back from');
      return false;
    }

    // Get the last opened modal
    const lastModalId = Array.from(this._activeModals).pop();
    return lastModalId ? this.close(lastModalId) : false;
  }

  /** Close all open modals. */
  public closeAll(): number {
    const count = this._activeModals.size;

    this._activeModals.clear();
    this._notify(ModalEvents.CLOSE_ALL, {});
    return count;
  }

  /**
   * Subscribe to modal events
   * @returns Unsubscribe function
   */
  public subscribe(event: ModalEventType, callback: ModalCb): () => void {
    if (!this._subscribers.has(event)) {
      this._subscribers.set(event, new Set());
    }
    this._subscribers.get(event)?.add(callback);

    return () => this.unsubscribe(event, callback);
  }

  /** Unsubscribe from modal events */
  public unsubscribe(event: ModalEventType, callback: ModalCb | undefined): void {
    if (this._subscribers.has(event)) {
      this._subscribers.get(event)?.delete(callback as ModalCb);
    }
  }

  /** Notify all subscribers of a modal event. */
  private _notify(
    event: ModalEventType,
    data:
      | {
          id: ModalId;
          modal: ModalNode;
        }
      | object,
  ): void {
    if (this._subscribers.has(event)) {
      for (const callback of this._subscribers.get(event) ?? new Set()) {
        try {
          callback(data as { id: ModalId; modal: ModalNode });
        } catch (error) {
          this._block.telemetryManager.sendEventError(error as unknown, 'modal subscriber');
          this._debugPrint('Error in modal subscriber:', error);
        }
      }
    }
  }

  /** Destroy the modal manager, clean up resources */
  public destroy(): void {
    this.closeAll();
    this._modals.clear();
    this._subscribers.clear();
    this._notify(ModalEvents.DESTROY, {});
  }
}
