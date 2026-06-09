import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { ActivityId } from '../../lit/activity-constants';
import { UploaderEventType } from '../EventBus';
import { NAVIGATE_CANCEL, RouterController, type RouterControllerDeps } from './RouterController';

const setup = () => {
  const emit = vi.fn() as Mock & RouterControllerDeps['emit'];
  const router = new RouterController({ emit });
  return { router, emit };
};

describe('RouterController (v2)', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('navigate + slots', () => {
    it('background strategy sets the activity slot, closes any modal, emits ACTIVITY_CHANGE', () => {
      const { router, emit } = setup();
      const onChange = vi.fn();
      router.subscribe(onChange);

      router.navigate('start-from', { foo: 1 });

      expect(router.activity).toBe('start-from');
      expect(router.modal).toBeNull();
      expect(router.params).toEqual({ foo: 1 });
      expect(emit).toHaveBeenCalledWith(UploaderEventType.ACTIVITY_CHANGE, { activity: 'start-from' });
      expect(onChange).toHaveBeenCalled();
    });

    it('foreground strategy opens a modal (background activity untouched)', () => {
      const { router, emit } = setup();
      router.navigationStrategy = () => 'foreground';

      router.navigate('camera');

      expect(router.modal).toBe('camera');
      expect(router.activity).toBeNull();
      expect(emit).toHaveBeenCalledWith(UploaderEventType.MODAL_OPEN, { activity: 'camera', modalId: 'camera' });
    });

    it('a background navigation closes an open modal first', () => {
      const { router, emit } = setup();
      router.navigationStrategy = (to) => (to === 'upload-list' ? 'background' : 'foreground');
      router.navigate('camera'); // foreground modal
      expect(router.modal).toBe('camera');
      emit.mockClear();

      router.navigate('upload-list'); // background → closes modal + sets activity

      expect(router.modal).toBeNull();
      expect(router.activity).toBe('upload-list');
      expect(emit).toHaveBeenCalledWith(
        UploaderEventType.MODAL_CLOSE,
        expect.objectContaining({ hasActiveModals: false }),
      );
    });

    it('navigate(null) closes everything', () => {
      const { router } = setup();
      router.navigate('start-from');
      router.navigate(null);
      expect(router.activity).toBeNull();
      expect(router.modal).toBeNull();
      expect(router.history).toEqual([]);
    });

    it('notifies on a params-only navigation (no slot change)', () => {
      const { router } = setup();
      router.navigate('start-from', { a: 1 });
      const onChange = vi.fn();
      router.subscribe(onChange);

      router.navigate('start-from', { a: 2 }); // same activity, new params

      expect(router.params).toEqual({ a: 2 });
      expect(onChange).toHaveBeenCalled();
    });

    it('treats the same params object reference as unchanged', () => {
      const { router } = setup();
      const params = { a: 1 };
      router.navigate('start-from', params);
      expect(() => router.navigate('start-from', params)).not.toThrow();
      expect(router.params).toBe(params);
    });

    it('dedups history when a modal opens an id already at the history top', () => {
      const { router } = setup();
      router.setActivity('camera'); // history ['camera']
      router.openModal('camera'); // pushes 'camera' again → deduped
      expect(router.history).toEqual(['camera']);
    });
  });

  describe('beforeChange hooks', () => {
    it('redirects to a hook-provided target', () => {
      const { router } = setup();
      router.hooks.beforeChange(() => 'upload-list');
      router.navigate('start-from');
      expect(router.activity).toBe('upload-list');
    });

    it('cancels navigation on NAVIGATE_CANCEL', () => {
      const { router } = setup();
      router.hooks.beforeChange(() => NAVIGATE_CANCEL);
      router.navigate('start-from');
      expect(router.activity).toBeNull();
    });

    it('lets the proposed target through when the hook returns undefined', () => {
      const { router } = setup();
      router.hooks.beforeChange(() => undefined);
      router.navigate('start-from');
      expect(router.activity).toBe('start-from');
    });

    it('unsubscribes a hook', () => {
      const { router } = setup();
      const unsub = router.hooks.beforeChange(() => NAVIGATE_CANCEL);
      unsub();
      router.navigate('start-from');
      expect(router.activity).toBe('start-from');
    });

    it('exposes ctx.defaults() (the proposed target) to beforeChange hooks', () => {
      const { router } = setup();
      let seen: unknown;
      router.hooks.beforeChange((ctx) => {
        seen = ctx.defaults();
        return undefined;
      });
      router.navigate('start-from');
      expect(seen).toBe('start-from');
    });

    it('registers onClose / onDone hooks without throwing', () => {
      const { router } = setup();
      expect(() => {
        router.hooks.onClose(() => null);
        router.hooks.onDone(() => null);
      }).not.toThrow();
    });
  });

  describe('history + back', () => {
    it('pushes activated activities, deduping consecutive repeats', () => {
      const { router } = setup();
      router.navigate('start-from');
      router.navigate('upload-list');
      router.navigate('upload-list'); // same → no dup
      expect(router.history).toEqual(['start-from', 'upload-list']);
      expect(router.canGoBack).toBe(true);
    });

    it('caps history at 10 entries', () => {
      const { router } = setup();
      // Cycle real ids — dedup only collapses *consecutive* repeats, so a
      // 6-id cycle gives 14 distinct-from-previous pushes to exercise the cap.
      const cycle: ActivityId[] = ['start-from', 'camera', 'upload-list', 'url', 'cloud-image-edit', 'external'];
      let last: ActivityId = 'start-from';
      for (let i = 0; i < 14; i++) {
        last = cycle[i % cycle.length] ?? 'start-from';
        router.navigate(last);
      }
      expect(router.history.length).toBe(10);
      expect(router.history.at(-1)).toBe(last);
    });

    it('back navigates to the previous entry', () => {
      const { router } = setup();
      router.navigate('start-from');
      router.navigate('camera');

      router.back();

      expect(router.activity).toBe('start-from');
    });

    it('back closes everything when there is no previous entry', () => {
      const { router } = setup();
      router.navigate('start-from');
      router.back();
      expect(router.activity).toBeNull();
    });

    it('back on empty history closes everything (no throw)', () => {
      const { router } = setup();
      expect(() => router.back()).not.toThrow();
      expect(router.activity).toBeNull();
    });
  });

  describe('setActivity / openModal / closeModal', () => {
    it('setActivity sets the background slot directly (bypasses beforeChange)', () => {
      const { router } = setup();
      router.hooks.beforeChange(() => NAVIGATE_CANCEL); // would block navigate()
      router.setActivity('start-from', { x: 1 });
      expect(router.activity).toBe('start-from');
      expect(router.params).toEqual({ x: 1 });
    });

    it('setActivity to the same value is a no-op', () => {
      const { router, emit } = setup();
      router.setActivity('start-from');
      emit.mockClear();
      router.setActivity('start-from');
      expect(emit).not.toHaveBeenCalled();
    });

    it('openModal emits MODAL_OPEN; a second open of the same id is a no-op', () => {
      const { router, emit } = setup();
      router.openModal('camera');
      expect(router.modal).toBe('camera');
      emit.mockClear();
      router.openModal('camera');
      expect(emit).not.toHaveBeenCalledWith(UploaderEventType.MODAL_OPEN, expect.anything());
    });

    it('closeModal emits MODAL_CLOSE only when a modal was open', () => {
      const { router, emit } = setup();
      router.closeModal(); // nothing open
      expect(emit).not.toHaveBeenCalled();

      router.openModal('camera');
      emit.mockClear();
      router.closeModal();
      expect(router.modal).toBeNull();
      expect(emit).toHaveBeenCalledWith(UploaderEventType.MODAL_CLOSE, {
        activity: null,
        modalId: null,
        hasActiveModals: false,
      });
    });
  });

  describe('afterFileAdd', () => {
    it('navigates to upload-list by default', () => {
      const { router } = setup();
      router.afterFileAdd();
      expect(router.activity).toBe('upload-list');
    });

    it('respects an afterFileAdd hook returning null (stay closed)', () => {
      const { router } = setup();
      router.hooks.afterFileAdd(() => null);
      router.afterFileAdd();
      expect(router.activity).toBeNull();
    });

    it('cancels when the afterFileAdd hook returns NAVIGATE_CANCEL', () => {
      const { router } = setup();
      router.setActivity('start-from');
      router.hooks.afterFileAdd(() => NAVIGATE_CANCEL);
      router.afterFileAdd();
      expect(router.activity).toBe('start-from'); // unchanged
    });

    it('exposes ctx.defaults() (upload-list) to afterFileAdd hooks', () => {
      const { router } = setup();
      let seen: unknown;
      router.hooks.afterFileAdd((ctx) => {
        seen = ctx.defaults();
        return undefined;
      });
      router.afterFileAdd();
      expect(seen).toBe('upload-list');
    });
  });

  describe('traverse + route table', () => {
    it('follows a static edge target from the route table', () => {
      const { router } = setup();
      router.configure({ activities: { 'start-from': { onBack: 'upload-list' } } });
      router.setActivity('start-from');

      router.traverse('onBack');

      expect(router.activity).toBe('upload-list');
    });

    it('follows an edge handler', () => {
      const { router } = setup();
      router.configure({ activities: { 'start-from': { onBack: () => 'camera' } } });
      router.setActivity('start-from');

      router.traverse('onBack');

      expect(router.activity).toBe('camera');
    });

    it('resolves an undefined edge to null (closes everything)', () => {
      const { router } = setup();
      router.setActivity('start-from');
      router.traverse('onBack'); // no route configured → null
      expect(router.activity).toBeNull();
    });

    it('runs the mapped hook for onCancel/onDone edges and can cancel', () => {
      const { router } = setup();
      router.configure({ activities: { 'start-from': { onCancel: 'upload-list' } } });
      router.setActivity('start-from');
      router.hooks.onCancel(() => NAVIGATE_CANCEL);

      router.traverse('onCancel');

      expect(router.activity).toBe('start-from'); // cancelled
    });

    it('is a no-op when there is no current activity', () => {
      const { router, emit } = setup();
      router.traverse('onBack');
      expect(emit).not.toHaveBeenCalled();
    });

    it('passes a ctx.defaults() to edge handlers', () => {
      const { router } = setup();
      let seen: unknown = 'unset';
      router.configure({
        activities: {
          'start-from': {
            onBack: (ctx) => {
              seen = ctx.defaults();
              return 'camera';
            },
          },
        },
      });
      router.setActivity('start-from');
      router.traverse('onBack');
      expect(seen).toBeNull();
      expect(router.activity).toBe('camera');
    });

    it('maps the onFileAdd edge to the afterFileAdd hook chain', () => {
      const { router } = setup();
      router.configure({ activities: { 'start-from': { onFileAdd: 'upload-list' } } });
      router.setActivity('start-from');
      const hook = vi.fn(() => undefined);
      router.hooks.afterFileAdd(hook);

      router.traverse('onFileAdd');

      expect(hook).toHaveBeenCalled();
      expect(router.activity).toBe('upload-list');
    });

    it('uses plugin-registered routes as a fallback', () => {
      const { router } = setup();
      router.addPluginRoutes('start-from', { onDone: 'upload-list' });
      router.setActivity('start-from');
      router.traverse('onDone');
      expect(router.activity).toBe('upload-list');
    });

    it('configure() defaults activities to an empty table', () => {
      const { router } = setup();
      expect(() => router.configure({})).not.toThrow();
      router.setActivity('start-from');
      router.traverse('onBack'); // no route → null
      expect(router.activity).toBeNull();
    });
  });

  describe('modal slot edges', () => {
    it('replacing one open modal with another emits no extra open/close', () => {
      const { router, emit } = setup();
      router.openModal('camera');
      emit.mockClear();

      router.openModal('url'); // a modal was already open

      expect(router.modal).toBe('url');
      expect(emit).not.toHaveBeenCalledWith(UploaderEventType.MODAL_OPEN, expect.anything());
      expect(emit).not.toHaveBeenCalledWith(UploaderEventType.MODAL_CLOSE, expect.anything());
    });
  });

  describe('destroy', () => {
    it('clears listeners and hooks', () => {
      const { router } = setup();
      const onChange = vi.fn();
      router.subscribe(onChange);
      router.hooks.beforeChange(() => NAVIGATE_CANCEL);

      router.destroy();

      router.navigate('start-from'); // hooks cleared → proceeds; listeners cleared → no notify
      expect(onChange).not.toHaveBeenCalled();
      expect(router.activity).toBe('start-from');
    });
  });
});
