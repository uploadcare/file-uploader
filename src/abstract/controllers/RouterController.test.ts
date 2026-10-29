import { computed } from '@lit-labs/signals';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActivityId } from '../activity-constants';
import { ControllerContainer } from '../di/ControllerContainer';
import { UploaderEventType } from '../EventBus';
import { EventEmitter } from '../EventEmitter';
import { SCOPE_BADGE_STYLE, UC_BADGE_STYLE } from '../logger';
import { ConfigController } from './ConfigController';
import { RouterController } from './RouterController';

const setup = () => {
  // RouterController is container-resolved: it emits via the
  // container-owned `EventEmitter`, `@inject`-ed lazily. Bind a spy so specs can
  // assert the exact `(type, payload, options)` dispatch — including the modal
  // debounce, which now lives inside RouterController's own `_emit`.
  const container = new ControllerContainer();
  const emit = vi.fn();
  container.bind(EventEmitter, () => ({ emit }) as unknown as EventEmitter);
  const router = container.get(RouterController);
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
      expect(emit).toHaveBeenCalledWith(UploaderEventType.MODAL_OPEN, { modalId: 'camera' }, { debounce: true });
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
        { debounce: true },
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

    it('back skips earlier entries of the activity already showing, as v1 did', () => {
      const { router } = setup();
      let listAllowed = true;
      router.guard('upload-list', () => listAllowed);
      // Upload, "Add more", upload again, then remove every file.
      router.navigate('start-from');
      router.navigate('upload-list');
      router.navigate('start-from');
      router.navigate('upload-list');
      listAllowed = false;
      router.revalidate(); // the emptied list goes back to start-from: [start-from, upload-list, start-from]

      router.back(); // Cancel on start-from

      expect(router.currentActivity).toBeNull();
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
    it('setActivity sets the background slot directly', () => {
      const { router } = setup();
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
      expect(emit).not.toHaveBeenCalled();
    });

    // QUIRK(router): each activity shown in the modal counts as a modal of its own, so a switch emits `modal-open`
    // and `modal-close` while the dialog stays open (NEXT-MAJOR(router) in `RouterController._transition`). Pinned as
    // current behaviour, not endorsed.
    it('switching the open modal to another activity emits modal-open for the new one and modal-close for the old', () => {
      const { router, emit } = setup();
      router.openModal('start-from');
      emit.mockClear();

      router.openModal('camera');

      const modalEvents = emit.mock.calls.filter(
        ([type]) => type === UploaderEventType.MODAL_OPEN || type === UploaderEventType.MODAL_CLOSE,
      );
      expect(modalEvents).toEqual([
        [UploaderEventType.MODAL_OPEN, { modalId: 'camera' }, { debounce: true }],
        [UploaderEventType.MODAL_CLOSE, { modalId: 'start-from', hasActiveModals: true }, { debounce: true }],
      ]);
    });

    it('restart keeps the target as the whole history when the flow is already there', () => {
      const { router } = setup();
      router.navigate('start-from');
      router.navigate('url');
      router.navigate('start-from');

      router.restart('start-from');

      expect(router.history).toEqual(['start-from']);
    });

    it('closeModal emits MODAL_CLOSE only when a modal was open', () => {
      const { router, emit } = setup();
      router.closeModal(); // nothing open
      expect(emit).not.toHaveBeenCalled();

      router.openModal('camera');
      emit.mockClear();
      router.closeModal();
      expect(router.modal).toBeNull();
      expect(emit).toHaveBeenCalledWith(
        UploaderEventType.MODAL_CLOSE,
        {
          modalId: 'camera',
          hasActiveModals: false,
        },
        { debounce: true },
      );
    });
  });

  describe('onFileAdd (traverse edge)', () => {
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
  });

  describe('modal slot edges', () => {
    // QUIRK(router): per-activity modal events, as above. Pinned as current behaviour, not endorsed.
    it('replacing one open modal with another emits open for the new one, close for the old, then the activity change', () => {
      const { router, emit } = setup();
      router.openModal('camera');
      emit.mockClear();

      router.openModal('url'); // a modal was already open

      expect(router.modal).toBe('url');
      expect(emit.mock.calls).toEqual([
        [UploaderEventType.MODAL_OPEN, { modalId: 'url' }, { debounce: true }],
        [UploaderEventType.MODAL_CLOSE, { modalId: 'camera', hasActiveModals: true }, { debounce: true }],
        [UploaderEventType.ACTIVITY_CHANGE, { activity: 'url' }],
      ]);
    });
  });

  describe('mounted activities', () => {
    it('reports a mounted activity as present', () => {
      const { router } = setup();

      router.activityBlockMounted('start-from');

      expect(router.hasMountedActivity('start-from')).toBe(true);
      expect(router.hasMountedActivity('camera')).toBe(false);
    });

    it('notifies subscribers on mount and on unmount', () => {
      const { router } = setup();
      const onChange = vi.fn();
      router.subscribe(onChange);

      const release = router.activityBlockMounted('start-from');
      expect(onChange).toHaveBeenCalledTimes(1);

      release();
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('refcounts — stays mounted while any slot still holds it, clears once all release', () => {
      const { router } = setup();

      const releaseA = router.activityBlockMounted('start-from');
      const releaseB = router.activityBlockMounted('start-from');
      expect(router.hasMountedActivity('start-from')).toBe(true);

      releaseA();
      expect(router.hasMountedActivity('start-from')).toBe(true); // second slot still mounted

      releaseB();
      expect(router.hasMountedActivity('start-from')).toBe(false);
    });

    it('releasing is idempotent — calling the same release fn twice does not under-count', () => {
      const { router } = setup();

      const releaseA = router.activityBlockMounted('start-from');
      router.activityBlockMounted('start-from');

      releaseA();
      releaseA(); // double-release must not double-decrement
      expect(router.hasMountedActivity('start-from')).toBe(true);
    });
  });

  describe('emit debounce', () => {
    it('debounces MODAL_OPEN and MODAL_CLOSE, emits ACTIVITY_CHANGE immediately', () => {
      const { router, emit } = setup();

      // openModal emits both MODAL_OPEN (debounced) and ACTIVITY_CHANGE (the
      // effective activity changed) — the modal carries the debounce option, the
      // activity change does not.
      router.openModal('camera');
      expect(emit).toHaveBeenCalledWith(UploaderEventType.MODAL_OPEN, { modalId: 'camera' }, { debounce: true });
      expect(emit).toHaveBeenCalledWith(UploaderEventType.ACTIVITY_CHANGE, { activity: 'camera' });

      router.closeModal();
      expect(emit).toHaveBeenCalledWith(
        UploaderEventType.MODAL_CLOSE,
        { modalId: 'camera', hasActiveModals: false },
        { debounce: true },
      );
    });

    it('never passes an options object for a non-modal (activity) event', () => {
      const { router, emit } = setup();
      router.navigate('start-from');
      const activityCall = emit.mock.calls.find(([type]) => type === UploaderEventType.ACTIVITY_CHANGE);
      expect(activityCall).toBeDefined();
      expect(activityCall).toHaveLength(2); // (type, payload) only — no debounce arg
    });
  });

  describe('currentActivity (signal-backed field)', () => {
    it('tracks the effective (modal-aware) activity across transitions', () => {
      const { router } = setup();
      expect(router.currentActivity).toBeNull();

      router.setActivity('start-from');
      expect(router.currentActivity).toBe('start-from'); // background slot

      router.openModal('camera');
      expect(router.currentActivity).toBe('camera'); // foreground wins

      router.closeModal();
      expect(router.currentActivity).toBe('start-from'); // falls back to background

      router.navigate(null);
      expect(router.currentActivity).toBeNull();
    });
  });

  describe('params (signal-backed field)', () => {
    it('lets a tracked reader see new params for the same activity', () => {
      const { router } = setup();
      router.activityBlockMounted('external' as never);
      router.navigate('external', { externalSourceType: 'dropbox' });
      const source = computed(() => router.params.externalSourceType);
      expect(source.get()).toBe('dropbox');

      router.navigate('external', { externalSourceType: 'gdrive' });

      expect(source.get()).toBe('gdrive');
    });
  });

  describe('guard-refused slot writes', () => {
    it('setActivity into a guarded-out target is refused (activity unchanged)', () => {
      const { router } = setup();
      router.guard('upload-list', () => false);

      router.setActivity('upload-list', { x: 1 });

      expect(router.activity).toBeNull();
      expect(router.params).toEqual({}); // params untouched — never entered
    });

    it('openModal into a guarded-out target is refused (no modal opens, no emit)', () => {
      const { router, emit } = setup();
      router.guard('camera', () => false);

      router.openModal('camera');

      expect(router.modal).toBeNull();
      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe('edge cases (coverage)', () => {
    it('revalidate() with nothing active is a no-op (null is always activatable)', () => {
      const { router } = setup();
      expect(() => router.revalidate()).not.toThrow();
      expect(router.currentActivity).toBeNull();
    });

    it('a mounted-activity release after destroy() cleared the map is a safe no-op', () => {
      const { router } = setup();
      const release = router.activityBlockMounted('start-from');
      router.destroy(); // clears the mounted-activity map
      // The release still runs (it was never called before), now against an empty
      // map — the refcount fallback keeps it from throwing / under-counting.
      expect(() => release()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('clears registered guards', () => {
      const { router } = setup();
      router.guard('upload-list', () => false);

      router.destroy();

      router.navigate('upload-list'); // guard cleared → allowed
      expect(router.currentActivity).toBe('upload-list');
    });

    it('clears listeners and hooks', () => {
      const { router } = setup();
      const onChange = vi.fn();
      router.subscribe(onChange);
      router.hooks.onFileAdd(() => null);

      router.destroy();

      router.traverse('onFileAdd'); // hooks cleared → default upload-list; listeners cleared → no notify
      expect(onChange).not.toHaveBeenCalled();
      expect(router.activity).toBe('upload-list');
    });
  });

  describe('debug logging (verbose, gated by this ctx debug)', () => {
    const setupDebug = () => {
      const container = new ControllerContainer();
      container.bind(EventEmitter, () => ({ emit: vi.fn() }) as unknown as EventEmitter);
      container.get(ConfigController).set('debug', true);
      return { router: container.get(RouterController) };
    };

    it('logs slot transitions, flagging background vs modal', () => {
      const { router } = setupDebug();
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const badge = ['%c uc %c router %c', UC_BADGE_STYLE, SCOPE_BADGE_STYLE, ''] as const;

      router.navigate('start-from'); // background strategy → background slot
      expect(log).toHaveBeenCalledWith(...badge, 'background activity: none → start-from');

      router.navigationStrategy = () => 'foreground';
      router.navigate('camera'); // foreground → modal slot
      expect(log).toHaveBeenCalledWith(...badge, 'modal activity: none → camera');
    });

    it('logs a traverse intent and a guard refusal', () => {
      const { router } = setupDebug();
      router.guard('camera', () => false); // camera not activatable
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      router.traverse('onClose');
      router.navigate('camera'); // refused by the guard

      expect(log).toHaveBeenCalledWith(
        '%c uc %c router %c',
        UC_BADGE_STYLE,
        SCOPE_BADGE_STYLE,
        '',
        'traverse "onClose"',
      );
      expect(log).toHaveBeenCalledWith(
        '%c uc %c router %c',
        UC_BADGE_STYLE,
        SCOPE_BADGE_STYLE,
        '',
        'navigate to "camera" refused (guard)',
      );
    });

    it('logs the applied navigation strategy', () => {
      const { router } = setupDebug();
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const badge = ['%c uc %c router %c', UC_BADGE_STYLE, SCOPE_BADGE_STYLE, ''] as const;

      router.navigate('upload-list');

      expect(log).toHaveBeenCalledWith(...badge, 'strategy for "upload-list": background');
    });

    it('logs guard registration and unregistration', () => {
      const { router } = setupDebug();
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const badge = ['%c uc %c router %c', UC_BADGE_STYLE, SCOPE_BADGE_STYLE, ''] as const;

      const off = router.guard('camera', () => true);
      expect(log).toHaveBeenCalledWith(...badge, 'guard registered: "camera"');

      off();
      expect(log).toHaveBeenCalledWith(...badge, 'guard unregistered: "camera"');
    });

    it('logs the configured done activity', () => {
      const { router } = setupDebug();
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      router.configure({ doneActivity: 'upload-list' });

      expect(log).toHaveBeenCalledWith(
        '%c uc %c router %c',
        UC_BADGE_STYLE,
        SCOPE_BADGE_STYLE,
        '',
        'configure: done activity = upload-list',
      );
    });

    it('does not log when this ctx has debug off', () => {
      const container = new ControllerContainer();
      container.bind(EventEmitter, () => ({ emit: vi.fn() }) as unknown as EventEmitter);
      const router = container.get(RouterController);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      router.navigate('start-from');
      router.traverse('onClose');

      expect(log).not.toHaveBeenCalled();
    });
  });
});
