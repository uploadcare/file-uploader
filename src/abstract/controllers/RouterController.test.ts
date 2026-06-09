import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';
import { ACTIVITY_TYPES } from '../../lit/activity-constants';
import { UploaderEventType } from '../EventBus';
import { RouterController, type RouterControllerDeps } from './RouterController';

const setup = (overrides: Partial<RouterControllerDeps> = {}) => {
  const emit = vi.fn() as Mock & RouterControllerDeps['emit'];
  const deps: RouterControllerDeps = {
    emit,
    couldOpenActivity: vi.fn(() => true),
    isHistoryTracked: vi.fn(() => true),
    getDoneActivity: vi.fn(() => null),
    hasFiles: vi.fn(() => false),
    getSourceList: vi.fn(() => []),
    pluginsReady: vi.fn(async () => {}),
    getSources: vi.fn(() => []),
    ...overrides,
  };
  const router = new RouterController(deps);
  return { router, deps, emit };
};

const { START_FROM, UPLOAD_LIST, CAMERA } = ACTIVITY_TYPES;

describe('RouterController', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('activity slot', () => {
    it('sets activity + params, emits ACTIVITY_CHANGE, and notifies subscribers', () => {
      const { router, emit } = setup();
      const onChange = vi.fn();
      router.subscribe(onChange);

      router.setActivity(START_FROM, { foo: 'bar' });

      expect(router.activity).toBe(START_FROM);
      expect(router.params).toEqual({ foo: 'bar' });
      expect(router.getCurrentActivity()).toBe(START_FROM);
      expect(emit).toHaveBeenCalledWith(UploaderEventType.ACTIVITY_CHANGE, { activity: START_FROM });
      expect(onChange).toHaveBeenCalled();
    });

    it('notifies but does not re-emit when the activity is unchanged', () => {
      const { router, emit } = setup();
      router.setActivity(START_FROM);
      emit.mockClear();
      const onChange = vi.fn();
      router.subscribe(onChange);

      router.setActivity(START_FROM, { x: 1 });

      expect(router.params).toEqual({ x: 1 });
      expect(emit).not.toHaveBeenCalled();
      expect(onChange).toHaveBeenCalled();
    });

    it('clears history when the activity is set to null (no ACTIVITY_CHANGE)', () => {
      const { router, emit } = setup();
      router.setActivity(START_FROM);
      emit.mockClear();

      router.setActivity(null);

      expect(router.activity).toBeNull();
      expect(router.history).toEqual([]);
      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    it('records tracked activities (deduping consecutive repeats)', () => {
      const { router } = setup({ isHistoryTracked: () => true });
      router.setActivity(START_FROM);
      router.setActivity(UPLOAD_LIST);
      router.setActivity(UPLOAD_LIST); // same → no dup push

      expect(router.history).toEqual([START_FROM, UPLOAD_LIST]);
    });

    it('does not record untracked activities', () => {
      const { router } = setup({ isHistoryTracked: () => false });
      router.setActivity(START_FROM);
      expect(router.history).toEqual([]);
    });

    it('trims history beyond 10 entries', () => {
      const tracked = [START_FROM, UPLOAD_LIST, CAMERA];
      const { router } = setup({ isHistoryTracked: () => true });
      // 12 distinct-ish pushes; the controller trims to <= 10 on flush
      for (let i = 0; i < 12; i++) {
        router.setActivity(tracked[i % 3] ?? null);
        // force distinct last by alternating so the dedup guard doesn't block
        router.setActivity(tracked[(i + 1) % 3] ?? null);
      }
      expect(router.history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('modal slot', () => {
    it('opens a modal: sets the slot + emits MODAL_OPEN', () => {
      const { router, emit } = setup();
      router.openModal(START_FROM);
      expect(router.modal).toBe(START_FROM);
      expect(emit).toHaveBeenCalledWith(UploaderEventType.MODAL_OPEN, { modalId: START_FROM });
    });

    it('ignores opening a falsy modal id', () => {
      const { router, emit } = setup();
      router.openModal('');
      expect(router.modal).toBeNull();
      expect(emit).not.toHaveBeenCalled();
    });

    it('closes a modal only when it matches the open slot, emitting MODAL_CLOSE', () => {
      const { router, emit } = setup();
      router.openModal(START_FROM);
      emit.mockClear();

      router.closeModal(UPLOAD_LIST); // not the open one → no-op
      expect(router.modal).toBe(START_FROM);
      expect(emit).not.toHaveBeenCalled();

      router.closeModal(START_FROM);
      expect(router.modal).toBeNull();
      expect(emit).toHaveBeenCalledWith(UploaderEventType.MODAL_CLOSE, {
        modalId: START_FROM,
        hasActiveModals: false,
      });
    });

    it('closeAllModals emits MODAL_CLOSE for the open modal (no-op when none)', () => {
      const { router, emit } = setup();
      router.closeAllModals(); // none open
      expect(emit).not.toHaveBeenCalled();

      router.openModal(UPLOAD_LIST);
      emit.mockClear();
      router.closeAllModals();
      expect(router.modal).toBeNull();
      expect(emit).toHaveBeenCalledWith(UploaderEventType.MODAL_CLOSE, {
        modalId: UPLOAD_LIST,
        hasActiveModals: false,
      });
    });
  });

  describe('setModalState', () => {
    it('opens the current activity modal when opened=true', () => {
      const { router, emit } = setup();
      router.setActivity(START_FROM);
      emit.mockClear();

      router.setModalState(true);

      expect(router.modal).toBe(START_FROM);
      expect(emit).toHaveBeenCalledWith(UploaderEventType.MODAL_OPEN, { modalId: START_FROM });
    });

    it('warns and no-ops when opening without a current activity', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { router } = setup();

      router.setModalState(true);

      expect(router.modal).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('without current activity'));
    });

    it('closes the modal and clears the activity when opened=false', () => {
      const { router } = setup();
      router.setActivity(START_FROM);
      router.openModal(START_FROM);

      router.setModalState(false);

      expect(router.modal).toBeNull();
      expect(router.activity).toBeNull();
    });

    it('opened=false with no current activity is a safe no-op', () => {
      const { router } = setup();
      expect(() => router.setModalState(false)).not.toThrow();
      expect(router.activity).toBeNull();
      expect(router.modal).toBeNull();
    });
  });

  describe('historyBack', () => {
    it('navigates to the previous (allowed) tracked activity and opens its modal', () => {
      const { router } = setup({ couldOpenActivity: () => true });
      router.setActivity(START_FROM);
      router.setActivity(UPLOAD_LIST);

      router.historyBack();

      expect(router.activity).toBe(START_FROM);
      expect(router.modal).toBe(START_FROM);
    });

    it('closes all when the previous activity is not allowed', () => {
      const couldOpenActivity = vi.fn(() => false);
      const { router } = setup({ couldOpenActivity });
      router.setActivity(START_FROM);
      router.setActivity(UPLOAD_LIST);
      router.openModal(UPLOAD_LIST);

      router.historyBack();

      expect(router.activity).toBeNull();
      expect(router.modal).toBeNull();
    });

    it('closes all when there is no previous activity', () => {
      const { router } = setup();
      router.setActivity(START_FROM);

      router.historyBack(); // only [start-from], which is current → skipped → null

      expect(router.activity).toBeNull();
    });

    it('is a safe no-op with empty history and no current activity', () => {
      const { router } = setup();
      router.openModal(START_FROM);

      expect(() => router.historyBack()).not.toThrow(); // must not loop forever

      expect(router.activity).toBeNull();
      expect(router.modal).toBeNull();
    });
  });

  describe('doneFlow', () => {
    it('navigates to the done activity and seeds history', () => {
      const { router } = setup({ getDoneActivity: () => UPLOAD_LIST });
      router.setActivity(START_FROM);

      router.doneFlow();

      expect(router.activity).toBe(UPLOAD_LIST);
      expect(router.history).toEqual([UPLOAD_LIST]);
    });

    it('closes all modals when there is no done activity', () => {
      const { router } = setup({ getDoneActivity: () => null });
      router.setActivity(START_FROM);
      router.openModal(START_FROM);

      router.doneFlow();

      expect(router.activity).toBeNull();
      expect(router.history).toEqual([]);
      expect(router.modal).toBeNull();
    });
  });

  describe('initFlow', () => {
    it('opens upload-list when there are files and not forced', async () => {
      const { router } = setup({ hasFiles: () => true });
      await router.initFlow();
      expect(router.activity).toBe(UPLOAD_LIST);
      expect(router.modal).toBe(UPLOAD_LIST);
    });

    it('opens start-from for a multi-source list', async () => {
      const { router } = setup({ getSourceList: () => ['local', 'url'] });
      await router.initFlow();
      expect(router.activity).toBe(START_FROM);
      expect(router.modal).toBe(START_FROM);
    });

    it('selects the single source directly when it does not expand', async () => {
      const onSelect = vi.fn();
      const { router } = setup({
        getSourceList: () => ['local'],
        getSources: () => [{ id: 'local', onSelect }],
      });
      await router.initFlow();
      expect(onSelect).toHaveBeenCalled();
      expect(router.activity).toBeNull(); // direct select, no activity change
    });

    it('opens start-from when the single source expands to multiple', async () => {
      const { router } = setup({
        getSourceList: () => ['camera'],
        getSources: () => [{ id: 'camera', expand: () => ['photo', 'video'], onSelect: vi.fn() }],
      });
      await router.initFlow();
      expect(router.activity).toBe(START_FROM);
    });

    it('selects the expanded source when it resolves to exactly one', async () => {
      const onSelect = vi.fn();
      const { router } = setup({
        getSourceList: () => ['camera'],
        getSources: () => [
          { id: 'camera', expand: () => ['photo'], onSelect: vi.fn() },
          { id: 'photo', onSelect },
        ],
      });
      await router.initFlow();
      expect(onSelect).toHaveBeenCalled();
    });

    it('falls back to the original source when the single expansion id is not separately registered', async () => {
      const onSelect = vi.fn();
      const { router } = setup({
        getSourceList: () => ['camera'],
        getSources: () => [{ id: 'camera', expand: () => ['photo'], onSelect }], // 'photo' not registered
      });
      await router.initFlow();
      expect(onSelect).toHaveBeenCalled();
    });

    it('re-opens the current activity modal when the single source is not registered', async () => {
      const { router } = setup({ getSourceList: () => ['ghost'], getSources: () => [] });
      router.setActivity(CAMERA);
      await router.initFlow();
      expect(router.modal).toBe(CAMERA);
    });

    it('does nothing for an unregistered single source with no current activity', async () => {
      const { router } = setup({ getSourceList: () => ['ghost'], getSources: () => [] });
      await router.initFlow();
      expect(router.modal).toBeNull();
      expect(router.activity).toBeNull();
    });

    it('forced ignores existing files and goes to start-from', async () => {
      const { router } = setup({ hasFiles: () => true, getSourceList: () => [] });
      await router.initFlow(true);
      expect(router.activity).toBe(START_FROM);
    });
  });

  describe('after-file-add hooks', () => {
    it('runs the default navigation when no hook handles it', () => {
      const { router } = setup();
      router.navigateAfterFileAdd();
      expect(router.activity).toBe(UPLOAD_LIST);
      expect(router.modal).toBe(UPLOAD_LIST);
    });

    it('respects a hook that handles navigation (and unsubscribe stops it)', () => {
      const { router } = setup();
      const hook = vi.fn(() => true);
      const unsub = router.registerAfterFileAddHook(hook);

      router.navigateAfterFileAdd();
      expect(hook).toHaveBeenCalledWith({ historyLength: 0 });
      expect(router.activity).toBeNull(); // hook handled → no default nav

      unsub();
      router.navigateAfterFileAdd();
      expect(router.activity).toBe(UPLOAD_LIST); // default nav again
    });
  });

  describe('destroy', () => {
    it('clears listeners and hooks', () => {
      const { router } = setup();
      const onChange = vi.fn();
      router.subscribe(onChange);
      router.registerAfterFileAddHook(() => true);

      router.destroy();

      router.setActivity(START_FROM);
      expect(onChange).not.toHaveBeenCalled();
      router.navigateAfterFileAdd(); // hooks cleared → default nav
      expect(router.activity).toBe(UPLOAD_LIST);
    });
  });
});
