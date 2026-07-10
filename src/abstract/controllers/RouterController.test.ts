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
      expect(router.currentActivity).toBe('camera');
      expect(emit).toHaveBeenCalledWith(UploaderEventType.MODAL_OPEN, { modalId: 'camera' });
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

    it('isolates a throwing beforeChange hook (proceeds to the proposed target, warns)', () => {
      const { router } = setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      router.hooks.beforeChange(() => {
        throw new Error('boom');
      });

      router.navigate('start-from');

      expect(router.activity).toBe('start-from'); // navigation not aborted
      expect(warn).toHaveBeenCalled();
    });

    it('runs later hooks after an earlier one throws', () => {
      const { router } = setup();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      router.hooks.beforeChange(() => {
        throw new Error('boom');
      });
      router.hooks.beforeChange(() => 'upload-list'); // still runs → redirects

      router.navigate('start-from');

      expect(router.activity).toBe('upload-list');
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

    it('beforeChange hooks observe the un-mutated history when back() fires them', () => {
      const { router } = setup();
      router.navigate('start-from');
      router.navigate('camera'); // history: [start-from, camera]
      let seen: readonly ActivityId[] | undefined;
      router.hooks.beforeChange(() => {
        seen = [...router.history];
        return undefined;
      });

      router.back();

      // The hook decides whether the navigation happens at all, so it must see
      // history as it was *before* back() touches it — including the entry
      // being left.
      expect(seen).toEqual(['start-from', 'camera']);
      expect(router.currentActivity).toBe('start-from');
      expect(router.history).toEqual(['start-from']);
    });

    it('a canceled back() leaves history intact and a later back() still works', () => {
      const { router } = setup();
      router.navigate('start-from');
      router.navigate('upload-list');
      router.navigate('camera'); // history: [start-from, upload-list, camera]
      let block = true;
      router.hooks.beforeChange(() => (block ? NAVIGATE_CANCEL : undefined));

      router.back(); // canceled — nothing may change

      expect(router.currentActivity).toBe('camera');
      expect(router.history).toEqual(['start-from', 'upload-list', 'camera']);
      expect(router.canGoBack).toBe(true);

      block = false;
      router.back(); // now allowed — lands on the real previous entry

      expect(router.currentActivity).toBe('upload-list');
      expect(router.history).toEqual(['start-from', 'upload-list']);
    });

    it('a beforeChange redirect during back() drops the left entry and records the target', () => {
      const { router } = setup();
      router.navigate('start-from');
      router.navigate('camera'); // history: [start-from, camera]
      router.hooks.beforeChange((ctx) => (ctx.proposed === 'start-from' ? 'url' : undefined));

      router.back(); // back from camera, redirected to url

      expect(router.currentActivity).toBe('url');
      // camera (the entry being left) is gone; back from url returns to
      // start-from, not to the screen the user just backed out of.
      expect(router.history).toEqual(['start-from', 'url']);
    });

    it('a back() redirect into a guarded-out target is refused with history untouched', () => {
      const { router } = setup();
      router.guard('upload-list', () => false);
      router.navigate('start-from');
      router.navigate('camera'); // history: [start-from, camera]
      router.hooks.beforeChange((ctx) =>
        ctx.edge === 'navigate' && ctx.from === 'camera' ? 'upload-list' : undefined,
      );

      router.back(); // redirect target is guarded-out → nothing happens

      expect(router.currentActivity).toBe('camera');
      expect(router.history).toEqual(['start-from', 'camera']);
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

    it('back skips a previous entry that is now guarded-out', () => {
      const { router } = setup();
      let listAllowed = true;
      router.guard('upload-list', () => listAllowed);
      router.navigate('start-from');
      router.navigate('upload-list');
      router.navigate('camera'); // history: [start-from, upload-list, camera]

      listAllowed = false; // upload-list emptied while camera is open
      router.back();

      // upload-list is guarded-out, so back() skips it and lands on start-from,
      // leaving history consistent with the visible activity.
      expect(router.currentActivity).toBe('start-from');
      expect(router.history).toEqual(['start-from']);
    });

    it('a canceled back() keeps guarded-out entries it would have skipped', () => {
      const { router } = setup();
      let listAllowed = true;
      router.guard('upload-list', () => listAllowed);
      router.navigate('start-from');
      router.navigate('upload-list');
      router.navigate('camera'); // history: [start-from, upload-list, camera]
      router.hooks.beforeChange(() => NAVIGATE_CANCEL);

      listAllowed = false;
      router.back(); // would skip upload-list and land on start-from — canceled

      expect(router.currentActivity).toBe('camera');
      // The guarded-out entry stays: its guard may hold again by the next
      // back() (e.g. files get added back to the list).
      expect(router.history).toEqual(['start-from', 'upload-list', 'camera']);
    });

    it('back closes everything when every previous entry is guarded-out', () => {
      const { router } = setup();
      let allowed = true;
      router.guard('upload-list', () => allowed);
      router.navigate('upload-list');
      router.navigate('camera'); // history: [upload-list, camera]

      allowed = false;
      router.back(); // only prev (upload-list) is guarded-out → close

      expect(router.currentActivity).toBeNull();
      expect(router.history).toEqual([]);
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
        modalId: 'camera',
        hasActiveModals: false,
      });
    });
  });

  describe('onFileAdd (traverse edge)', () => {
    it('navigates to upload-list by default', () => {
      const { router } = setup();
      router.traverse('onFileAdd');
      expect(router.activity).toBe('upload-list');
    });

    it('respects an onFileAdd hook returning null (stay closed)', () => {
      const { router } = setup();
      router.hooks.onFileAdd(() => null);
      router.traverse('onFileAdd');
      expect(router.activity).toBeNull();
    });

    it('cancels when the onFileAdd hook returns NAVIGATE_CANCEL', () => {
      const { router } = setup();
      router.setActivity('start-from');
      router.hooks.onFileAdd(() => NAVIGATE_CANCEL);
      router.traverse('onFileAdd');
      expect(router.activity).toBe('start-from'); // unchanged
    });

    it('exposes the effective (modal-aware) activity as ctx.from', () => {
      const { router } = setup();
      router.setActivity('start-from');
      router.openModal('camera'); // camera is what the user actually sees
      let seen: unknown;
      router.hooks.onFileAdd((ctx) => {
        seen = ctx.from;
        return NAVIGATE_CANCEL;
      });

      router.traverse('onFileAdd');

      expect(seen).toBe('camera');
    });

    it('exposes ctx.defaults() (upload-list) to onFileAdd hooks', () => {
      const { router } = setup();
      let seen: unknown;
      router.hooks.onFileAdd((ctx) => {
        seen = ctx.defaults();
        return undefined;
      });
      router.traverse('onFileAdd');
      expect(seen).toBe('upload-list');
    });

    it('isolates a throwing onFileAdd hook and falls back to upload-list', () => {
      const { router } = setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      router.hooks.onFileAdd(() => {
        throw new Error('boom');
      });

      router.traverse('onFileAdd'); // hook throws → default upload-list still applies

      expect(router.activity).toBe('upload-list');
      expect(warn).toHaveBeenCalled();
    });
  });

  describe('configure (solution-level routing)', () => {
    it('exposes the configured done activity', () => {
      const { router } = setup();
      expect(router.doneActivity).toBeNull();
      router.configure({ doneActivity: 'upload-list' });
      expect(router.doneActivity).toBe('upload-list');
    });
  });

  describe('guards', () => {
    it('blocks navigation into a guarded-out activity (stays put)', () => {
      const { router } = setup();
      let allowed = false;
      router.guard('upload-list', () => allowed);
      router.navigate('start-from');

      router.navigate('upload-list'); // guarded out → refused
      expect(router.currentActivity).toBe('start-from');

      allowed = true;
      router.navigate('upload-list'); // now allowed
      expect(router.currentActivity).toBe('upload-list');
    });

    it('revalidate() leaves the current activity when its guard no longer holds', () => {
      const { router } = setup();
      let allowed = true;
      router.guard('upload-list', () => allowed);
      router.navigate('start-from');
      router.navigate('upload-list');
      expect(router.currentActivity).toBe('upload-list');

      allowed = false;
      router.revalidate(); // guard fails → back to previous
      expect(router.currentActivity).toBe('start-from');
    });

    it('revalidate() is a no-op while the guard holds', () => {
      const { router } = setup();
      router.guard('upload-list', () => true);
      router.navigate('upload-list');
      router.revalidate();
      expect(router.currentActivity).toBe('upload-list');
    });

    it('unregistering removes the guard', () => {
      const { router } = setup();
      const unregister = router.guard('upload-list', () => false);
      unregister();
      router.navigate('upload-list'); // no guard now → allowed
      expect(router.currentActivity).toBe('upload-list');
    });

    it('treats a throwing guard as not-activatable (refuses navigation, warns)', () => {
      const { router } = setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      router.guard('upload-list', () => {
        throw new Error('boom');
      });
      router.navigate('start-from');

      router.navigate('upload-list'); // guard throws → refused, not crashed

      expect(router.currentActivity).toBe('start-from');
      expect(warn).toHaveBeenCalled();
    });

    it('revalidate() does not throw when the current activity guard throws', () => {
      const { router } = setup();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      let throws = false;
      router.guard('upload-list', () => {
        if (throws) throw new Error('boom');
        return true;
      });
      router.navigate('start-from');
      router.navigate('upload-list');

      throws = true;
      expect(() => router.revalidate()).not.toThrow();
      expect(router.currentActivity).toBe('start-from'); // guard failed → backed out
    });
  });

  describe('traverse (navigation intents)', () => {
    it('onBack defaults to back()', () => {
      const { router } = setup();
      router.navigate('start-from');
      router.navigate('camera');
      router.traverse('onBack');
      expect(router.currentActivity).toBe('start-from');
    });

    it('onClose defaults to close() (everything closed)', () => {
      const { router } = setup();
      router.navigate('start-from');
      router.traverse('onClose');
      expect(router.currentActivity).toBeNull();
    });

    it('onDone defaults to navigating to the configured done activity', () => {
      const { router } = setup();
      router.configure({ doneActivity: 'upload-list' });
      router.navigate('start-from');
      router.traverse('onDone');
      expect(router.currentActivity).toBe('upload-list');
    });

    it('an edge hook can redirect the intent', () => {
      const { router } = setup();
      router.navigate('camera');
      router.hooks.onCancel(() => 'upload-list');
      router.traverse('onCancel');
      expect(router.currentActivity).toBe('upload-list');
    });

    it('an edge hook can cancel the intent (NAVIGATE_CANCEL)', () => {
      const { router } = setup();
      router.navigate('camera');
      router.hooks.onClose(() => NAVIGATE_CANCEL);
      router.traverse('onClose');
      expect(router.currentActivity).toBe('camera'); // unchanged
    });

    it('a hook returning undefined defers to the default', () => {
      const { router } = setup();
      router.navigate('start-from');
      router.navigate('camera');
      router.hooks.onBack(() => undefined);
      router.traverse('onBack');
      expect(router.currentActivity).toBe('start-from');
    });

    it('onFileAdd defaults to navigating to upload-list', () => {
      const { router } = setup();
      router.traverse('onFileAdd');
      expect(router.currentActivity).toBe('upload-list');
    });

    it('hooks registered via hooks.onFileAdd intercept traverse(onFileAdd)', () => {
      const { router } = setup();
      router.hooks.onFileAdd(() => null); // DynamicBtn: keep the modal closed
      router.traverse('onFileAdd');
      expect(router.currentActivity).toBeNull();
    });

    it('isolates a throwing edge hook and falls back to the default', () => {
      const { router } = setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      router.navigate('start-from');
      router.hooks.onClose(() => {
        throw new Error('boom');
      });

      router.traverse('onClose'); // hook throws → default close() still runs

      expect(router.currentActivity).toBeNull();
      expect(warn).toHaveBeenCalled();
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
