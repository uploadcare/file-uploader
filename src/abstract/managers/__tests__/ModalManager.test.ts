import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import type { Modal as ModalNode } from '../../../blocks/Modal/Modal';
import type { SharedInstancesBag } from '../../../lit/shared-instances';
import type { ModalId } from '../ModalManager';
import { ModalEvents, ModalManager } from '../ModalManager';

let telemetryManagerMock: TelemetryManager;

const createSharedInstancesBag = (): SharedInstancesBag => {
  telemetryManagerMock = {
    sendEventError: vi.fn(),
  } as unknown as TelemetryManager;
  const ctx = {
    read: vi.fn().mockReturnValue(false),
    has: vi.fn().mockReturnValue(true),
  } as unknown as SharedInstancesBag['ctx'];
  return {
    get ctx() {
      return ctx;
    },
    get modalManager() {
      return null;
    },
    get telemetryManager() {
      return telemetryManagerMock;
    },
  } as unknown as SharedInstancesBag;
};

const createMockModal = (id: ModalId): ModalNode =>
  ({
    id,
    show: vi.fn(),
    hide: vi.fn(),
  }) as unknown as ModalNode;

const assignDebugPrint = (instance: ModalManager): ReturnType<typeof vi.fn> => {
  const debugPrint = vi.fn();
  (instance as unknown as { _debugPrint: typeof debugPrint })._debugPrint = debugPrint;
  return debugPrint;
};

describe('ModalManager', () => {
  let manager: ModalManager & { _debugPrint: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const bag = createSharedInstancesBag();
    const newManager = new ModalManager(bag);
    assignDebugPrint(newManager);

    manager = newManager as ModalManager & { _debugPrint: ReturnType<typeof vi.fn> };
  });

  describe('constructor', () => {
    it('should create a new ModalManager instance', () => {
      expect(manager).toBeInstanceOf(ModalManager);
    });
  });

  describe('registerModal', () => {
    it('should register a modal', () => {
      const modal = createMockModal('test-modal');
      const callback = vi.fn();

      manager.subscribe(ModalEvents.ADD, callback);
      manager.registerModal('test-modal', modal);

      expect(callback).toHaveBeenCalledWith({ id: 'test-modal', modal });
    });

    it('should allow registering multiple modals', () => {
      const modal1 = createMockModal('modal-1');
      const modal2 = createMockModal('modal-2');
      const callback = vi.fn();

      manager.subscribe(ModalEvents.ADD, callback);
      manager.registerModal('modal-1', modal1);
      manager.registerModal('modal-2', modal2);

      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteModal', () => {
    it('should delete an existing modal', () => {
      const modal = createMockModal('test-modal');
      const callback = vi.fn();

      manager.registerModal('test-modal', modal);
      manager.subscribe(ModalEvents.DELETE, callback);

      const result = manager.deleteModal('test-modal');

      expect(result).toBe(true);
      expect(callback).toHaveBeenCalledWith({ id: 'test-modal', modal });
    });

    it('should return false when deleting non-existent modal', () => {
      const result = manager.deleteModal('non-existent');

      expect(result).toBe(false);
    });

    it('should remove modal from active modals when deleted', () => {
      const modal = createMockModal('test-modal');

      manager.registerModal('test-modal', modal);
      manager.open('test-modal');

      expect(manager.hasActiveModals).toBe(true);

      manager.deleteModal('test-modal');

      expect(manager.hasActiveModals).toBe(false);
    });
  });

  describe('open', () => {
    it('should open a registered modal', () => {
      const modal = createMockModal('test-modal');
      const callback = vi.fn();

      manager.registerModal('test-modal', modal);
      manager.subscribe(ModalEvents.OPEN, callback);

      const result = manager.open('test-modal');

      expect(result).toBe(true);
      expect(callback).toHaveBeenCalledWith({ id: 'test-modal', modal });
    });

    it('should return false for non-existent modal', () => {
      const result = manager.open('non-existent');

      expect(result).toBe(false);
      expect(manager._debugPrint).toHaveBeenCalled();
    });

    it('should set hasActiveModals to true after opening', () => {
      const modal = createMockModal('test-modal');

      manager.registerModal('test-modal', modal);

      expect(manager.hasActiveModals).toBe(false);

      manager.open('test-modal');

      expect(manager.hasActiveModals).toBe(true);
    });
  });

  describe('close', () => {
    it('should close an open modal', () => {
      const modal = createMockModal('test-modal');
      const callback = vi.fn();

      manager.registerModal('test-modal', modal);
      manager.open('test-modal');
      manager.subscribe(ModalEvents.CLOSE, callback);

      const result = manager.close('test-modal');

      expect(result).toBe(true);
      expect(callback).toHaveBeenCalledWith({ id: 'test-modal', modal });
    });

    it('should return false for non-existent modal', () => {
      const result = manager.close('non-existent');

      expect(result).toBe(false);
      expect(manager._debugPrint).toHaveBeenCalled();
    });

    it('should return false for modal that is not active', () => {
      const modal = createMockModal('test-modal');

      manager.registerModal('test-modal', modal);

      const result = manager.close('test-modal');

      expect(result).toBe(false);
    });

    it('should set hasActiveModals to false after closing last modal', () => {
      const modal = createMockModal('test-modal');

      manager.registerModal('test-modal', modal);
      manager.open('test-modal');

      expect(manager.hasActiveModals).toBe(true);

      manager.close('test-modal');

      expect(manager.hasActiveModals).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should open a closed modal', () => {
      const modal = createMockModal('test-modal');
      const openCallback = vi.fn();

      manager.registerModal('test-modal', modal);
      manager.subscribe(ModalEvents.OPEN, openCallback);

      const result = manager.toggle('test-modal');

      expect(result).toBe(true);
      expect(openCallback).toHaveBeenCalled();
    });

    it('should close an open modal', () => {
      const modal = createMockModal('test-modal');
      const closeCallback = vi.fn();

      manager.registerModal('test-modal', modal);
      manager.open('test-modal');
      manager.subscribe(ModalEvents.CLOSE, closeCallback);

      const result = manager.toggle('test-modal');

      expect(result).toBe(true);
      expect(closeCallback).toHaveBeenCalled();
    });

    it('should return false for non-existent modal', () => {
      const result = manager.toggle('non-existent');

      expect(result).toBe(false);
      expect(manager._debugPrint).toHaveBeenCalled();
    });
  });

  describe('hasActiveModals', () => {
    it('should return false when no modals are active', () => {
      expect(manager.hasActiveModals).toBe(false);
    });

    it('should return true when at least one modal is active', () => {
      const modal = createMockModal('test-modal');

      manager.registerModal('test-modal', modal);
      manager.open('test-modal');

      expect(manager.hasActiveModals).toBe(true);
    });

    it('should return true when multiple modals are active', () => {
      const modal1 = createMockModal('modal-1');
      const modal2 = createMockModal('modal-2');

      manager.registerModal('modal-1', modal1);
      manager.registerModal('modal-2', modal2);
      manager.open('modal-1');
      manager.open('modal-2');

      expect(manager.hasActiveModals).toBe(true);
    });
  });

  describe('back', () => {
    it('should close the most recently opened modal', () => {
      const modal1 = createMockModal('modal-1');
      const modal2 = createMockModal('modal-2');
      const closeCallback = vi.fn();

      manager.registerModal('modal-1', modal1);
      manager.registerModal('modal-2', modal2);
      manager.open('modal-1');
      manager.open('modal-2');
      manager.subscribe(ModalEvents.CLOSE, closeCallback);

      const result = manager.back();

      expect(result).toBe(true);
      expect(closeCallback).toHaveBeenCalledWith({ id: 'modal-2', modal: modal2 });
    });

    it('should return false when no active modals', () => {
      const result = manager.back();

      expect(result).toBe(false);
      expect(manager._debugPrint).toHaveBeenCalled();
    });

    it('should close only the last modal and keep previous ones active', () => {
      const modal1 = createMockModal('modal-1');
      const modal2 = createMockModal('modal-2');

      manager.registerModal('modal-1', modal1);
      manager.registerModal('modal-2', modal2);
      manager.open('modal-1');
      manager.open('modal-2');

      manager.back();

      expect(manager.hasActiveModals).toBe(true);
    });
  });

  describe('closeAll', () => {
    it('should close all open modals and return count', () => {
      const modal1 = createMockModal('modal-1');
      const modal2 = createMockModal('modal-2');
      const closeAllCallback = vi.fn();

      manager.registerModal('modal-1', modal1);
      manager.registerModal('modal-2', modal2);
      manager.open('modal-1');
      manager.open('modal-2');
      manager.subscribe(ModalEvents.CLOSE_ALL, closeAllCallback);

      const count = manager.closeAll();

      expect(count).toBe(2);
      expect(manager.hasActiveModals).toBe(false);
      expect(closeAllCallback).toHaveBeenCalled();
    });

    it('should return 0 when no modals are open', () => {
      const count = manager.closeAll();

      expect(count).toBe(0);
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('should subscribe to events and receive notifications', () => {
      const callback = vi.fn();

      manager.subscribe(ModalEvents.ADD, callback);

      const modal = createMockModal('test-modal');
      manager.registerModal('test-modal', modal);

      expect(callback).toHaveBeenCalledWith({ id: 'test-modal', modal });
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = manager.subscribe(ModalEvents.ADD, callback);

      unsubscribe();

      const modal = createMockModal('test-modal');
      manager.registerModal('test-modal', modal);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should unsubscribe using unsubscribe method', () => {
      const callback = vi.fn();

      manager.subscribe(ModalEvents.ADD, callback);
      manager.unsubscribe(ModalEvents.ADD, callback);

      const modal = createMockModal('test-modal');
      manager.registerModal('test-modal', modal);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle unsubscribe with undefined callback', () => {
      manager.subscribe(ModalEvents.ADD, vi.fn());

      // Should not throw
      expect(() => manager.unsubscribe(ModalEvents.ADD, undefined)).not.toThrow();
    });

    it('should handle multiple subscribers for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      manager.subscribe(ModalEvents.ADD, callback1);
      manager.subscribe(ModalEvents.ADD, callback2);

      const modal = createMockModal('test-modal');
      manager.registerModal('test-modal', modal);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle subscriber error gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const successCallback = vi.fn();

      manager.subscribe(ModalEvents.ADD, errorCallback);
      manager.subscribe(ModalEvents.ADD, successCallback);

      const modal = createMockModal('test-modal');
      manager.registerModal('test-modal', modal);

      expect(telemetryManagerMock.sendEventError).toHaveBeenCalled();
      expect(manager._debugPrint).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should close all modals and clear resources', () => {
      const modal = createMockModal('test-modal');
      const closeAllCallback = vi.fn();

      manager.registerModal('test-modal', modal);
      manager.open('test-modal');
      manager.subscribe(ModalEvents.CLOSE_ALL, closeAllCallback);

      manager.destroy();

      expect(manager.hasActiveModals).toBe(false);
      expect(closeAllCallback).toHaveBeenCalled();
    });

    it('should clear all modals after destroy', () => {
      const modal = createMockModal('test-modal');

      manager.registerModal('test-modal', modal);
      manager.destroy();

      const result = manager.open('test-modal');
      expect(result).toBe(false);
    });

    it('should clear all subscribers after destroy', () => {
      const callback = vi.fn();

      manager.subscribe(ModalEvents.ADD, callback);
      manager.destroy();

      const modal = createMockModal('test-modal');
      manager.registerModal('test-modal', modal);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('ModalEvents', () => {
    it('should have correct event constants', () => {
      expect(ModalEvents.ADD).toBe('modal:add');
      expect(ModalEvents.DELETE).toBe('modal:delete');
      expect(ModalEvents.OPEN).toBe('modal:open');
      expect(ModalEvents.CLOSE).toBe('modal:close');
      expect(ModalEvents.CLOSE_ALL).toBe('modal:closeAll');
      expect(ModalEvents.DESTROY).toBe('modal:destroy');
    });

    it('should be frozen', () => {
      expect(Object.isFrozen(ModalEvents)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle opening the same modal multiple times', () => {
      const modal = createMockModal('test-modal');
      const openCallback = vi.fn();

      manager.registerModal('test-modal', modal);
      manager.subscribe(ModalEvents.OPEN, openCallback);

      manager.open('test-modal');
      manager.open('test-modal');

      expect(openCallback).toHaveBeenCalledTimes(2);
    });

    it('should handle registering modal with same id (overwrite)', () => {
      const modal1 = createMockModal('test-modal');
      const modal2 = createMockModal('test-modal');
      const addCallback = vi.fn();

      manager.subscribe(ModalEvents.ADD, addCallback);
      manager.registerModal('test-modal', modal1);
      manager.registerModal('test-modal', modal2);

      expect(addCallback).toHaveBeenCalledTimes(2);
      expect(addCallback).toHaveBeenLastCalledWith({ id: 'test-modal', modal: modal2 });
    });

    it('should handle closing already closed modal', () => {
      const modal = createMockModal('test-modal');

      manager.registerModal('test-modal', modal);
      manager.open('test-modal');
      manager.close('test-modal');

      const result = manager.close('test-modal');
      expect(result).toBe(false);
    });
  });
});
