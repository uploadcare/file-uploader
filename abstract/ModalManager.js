//@ts-check

export const ModalEvents = Object.freeze({
  ADD: 'modal:add',
  DELETE: 'modal:delete',
  OPEN: 'modal:open',
  CLOSE: 'modal:close',
  CLOSE_ALL: 'modal:closeAll',
  DESTROY: 'modal:destroy',
});

/** @typedef {import('../abstract/ActivityBlock').ActivityType} ModalId */

/** @typedef {import('../blocks/Modal/Modal.js').Modal} ModalNode */

/** @typedef {(data: { id: ModalId; modal: ModalNode }) => void} ModalCb */

/** @typedef {(typeof ModalEvents)[keyof ModalEvents]} ModalEventType */

export class ModalManager {
  /**
   * @private
   * @type {Map<ModalId, ModalNode>}
   */
  _modals = new Map();

  /**
   * @private
   * @type {Set<ModalId>}
   */
  _activeModals = new Set();

  /**
   * @private
   * @type {Map<ModalEventType, Set<ModalCb>>}
   */
  _subscribers = new Map();

  /** @param {import('./Block.js').Block} block */
  constructor(block) {
    this._block = block;
  }

  /**
   * @private
   * @param {unknown[]} args
   */
  _debugPrint(...args) {
    this._block.debugPrint('[modal-manager]', ...args);
  }

  /**
   * Register a modal with the manager
   *
   * @param {ModalId} id - Unique identifier for the modal
   * @param {ModalNode} modal - Modal component instance
   */
  registerModal(id, modal) {
    this._modals.set(id, modal);
    this._notify(ModalEvents.ADD, { id, modal });
  }

  /** @param {ModalId} id - Unique identifier for the modal */
  deleteModal(id) {
    if (!this._modals.has(id)) return false;

    const modal = this._modals.get(id);
    this._modals.delete(id);
    this._activeModals.delete(id);
    this._notify(ModalEvents.DELETE, { id, modal });
    return true;
  }

  /**
   * Open a modal by its ID
   *
   * @param {ModalId} id - The ID of the modal to open
   * @returns {boolean} - Success status
   */
  open(id) {
    if (!this._modals.has(id)) {
      this._debugPrint(`Modal with ID "${id}" not found`);
      return false;
    }

    const modal = this._modals.get(id);

    this._activeModals.add(id);
    this._notify(ModalEvents.OPEN, { modal, id });
    return true;
  }

  /**
   * Close a specific modal by ID
   *
   * @param {ModalId} id - The ID of the modal to close
   * @returns {boolean} - Success status
   */
  close(id) {
    if (!this._modals.has(id) || !this._activeModals.has(id)) {
      this._debugPrint(`Modal with ID "${id}" not found or not active`);
      return false;
    }

    const modal = this._modals.get(id);

    this._activeModals.delete(id);
    this._notify(ModalEvents.CLOSE, { id, modal });
    return true;
  }

  /**
   * Toggle a modal - open if closed, close if open
   *
   * @param {ModalId} id - The ID of the modal to toggle
   * @returns {boolean} - Success status
   */
  toggle(id) {
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

  /**
   * Check if any modals are currently active/open
   *
   * @returns {boolean} - True if there are any active modals
   */
  get hasActiveModals() {
    return this._activeModals.size > 0;
  }

  /**
   * Close the most recently opened modal and return to the previous one
   *
   * @returns {boolean} - Success status
   */
  back() {
    if (this._activeModals.size === 0) {
      this._debugPrint('No active modals to go back from');
      return false;
    }

    // Get the last opened modal
    const lastModalId = Array.from(this._activeModals).pop();
    return this.close(/** @type {string} */ (lastModalId));
  }

  /**
   * Close all open modals
   *
   * @returns {number} - Number of modals closed
   */
  closeAll() {
    const count = this._activeModals.size;

    this._activeModals.clear();
    this._notify(ModalEvents.CLOSE_ALL, {});
    return count;
  }

  /**
   * Subscribe to modal events
   *
   * @param {ModalEventType} event
   * @param {ModalCb} callback
   * @returns {() => void}
   */
  subscribe(event, callback) {
    if (!this._subscribers.has(event)) {
      this._subscribers.set(event, new Set());
    }
    this._subscribers.get(event)?.add(callback);

    return () => this.unsubscribe(event, callback);
  }

  /**
   * Unsubscribe from modal events
   *
   * @param {ModalEventType} event
   * @param {ModalCb | undefined} callback
   */
  unsubscribe(event, callback) {
    if (this._subscribers.has(event)) {
      this._subscribers.get(event)?.delete(/** @type {ModalCb} */ (callback));
    }
  }

  /**
   * Notify all subscribers of a modal event
   *
   * @private
   * @param {ModalEventType} event - Event name
   * @param {{
   *       id: ModalId;
   *       modal: ModalNode;
   *     }
   *   | object} data
   */
  _notify(event, data) {
    if (this._subscribers.has(event)) {
      for (const callback of this._subscribers.get(event) ?? new Set()) {
        try {
          callback(
            /**
             * @type{{
             * id: ModalId;
             * modal: ModalNode;
             * }}
             */ (data),
          );
        } catch (error) {
          this._debugPrint('Error in modal subscriber:', error);
        }
      }
    }
  }

  /** Destroy the modal manager, clean up resources */
  destroy() {
    this.closeAll();
    this._modals.clear();
    this._subscribers.clear();
    this._notify(ModalEvents.DESTROY, {});
  }
}
