import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClipboardController } from '../abstract/controllers/ClipboardController';
import { ConfigController } from '../abstract/controllers/ConfigController';
import { LocaleController } from '../abstract/controllers/LocaleController';
import { RouterController } from '../abstract/controllers/RouterController';
import { ControllerContainer } from '../abstract/di/ControllerContainer';
import { UploaderEventType } from '../abstract/EventBus';
import { A11y } from '../abstract/managers/a11y';
import { LocaleManager } from '../abstract/managers/LocaleManager';
import { TelemetryManager } from '../abstract/managers/TelemetryManager';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { initialConfig } from '../blocks/Config/initialConfig';
import { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import { PubSub } from './PubSubCompat';

// Each test uses a unique ctx id and tears it down so the module-level
// context/controller maps and the global UploaderRegistry don't leak.
let seq = 0;
const ids: string[] = [];
const freshCtx = () => {
  const id = `pubsub-test-${seq++}`;
  ids.push(id);
  return PubSub.registerCtx<Record<string, unknown>>({ plain: 'seed' }, id);
};

afterEach(() => {
  for (const id of ids.splice(0)) PubSub.deleteCtx(id);
});

describe('PubSub config (*cfg/*) facade', () => {
  it('reads built-in config defaults from the controller without touching the nanostores store', () => {
    const ctx = freshCtx();
    expect(ctx.read('*cfg/multiple')).toBe(initialConfig.multiple);
    // Routed away from nanostores — the key never lands in the raw store.
    expect('*cfg/multiple' in ctx.store).toBe(false);
  });

  it('round-trips a config write through the controller', () => {
    const ctx = freshCtx();
    ctx.pub('*cfg/multiple', false);
    expect(ctx.read('*cfg/multiple')).toBe(false);
  });

  it('sub fires immediately when init=true and on subsequent changes to that key', () => {
    const ctx = freshCtx();
    const cb = vi.fn();
    ctx.sub('*cfg/multiple', cb, true);
    expect(cb).toHaveBeenLastCalledWith(initialConfig.multiple);

    ctx.pub('*cfg/multiple', false);
    expect(cb).toHaveBeenLastCalledWith(false);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('sub with init=false does not fire immediately', () => {
    const ctx = freshCtx();
    const cb = vi.fn();
    ctx.sub('*cfg/multiple', cb, false);
    expect(cb).not.toHaveBeenCalled();

    ctx.pub('*cfg/multiple', false);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('a config sub does NOT fire when a different config key changes', () => {
    const ctx = freshCtx();
    const cb = vi.fn();
    ctx.sub('*cfg/multiple', cb, false);

    ctx.pub('*cfg/thumbSize', 120);
    expect(cb).not.toHaveBeenCalled();
  });

  it('has() is true for built-ins, false for unknown custom keys until added', () => {
    const ctx = freshCtx();
    expect(ctx.has('*cfg/multiple')).toBe(true);
    expect(ctx.has('*cfg/myPluginKey')).toBe(false);

    ctx.add('*cfg/myPluginKey', 'def');
    expect(ctx.has('*cfg/myPluginKey')).toBe(true);
    expect(ctx.read('*cfg/myPluginKey')).toBe('def');
  });

  it('add() is first-write-wins for known keys and overwrites only on rewrite', () => {
    const ctx = freshCtx();
    ctx.pub('*cfg/multiple', false);

    ctx.add('*cfg/multiple', true); // no rewrite — keeps current
    expect(ctx.read('*cfg/multiple')).toBe(false);

    ctx.add('*cfg/multiple', true, true); // rewrite
    expect(ctx.read('*cfg/multiple')).toBe(true);
  });

  it('registers the controller in UploaderRegistry on first config access and shares it across wrappers', () => {
    const ctx = freshCtx();
    const id = ctx.id;
    ctx.read('*cfg/multiple'); // triggers lazy controller creation

    const container = UploaderRegistry.get(id);
    expect(container).toBeDefined();

    // A second wrapper for the same ctx sees the same config state.
    const ctx2 = PubSub.getCtx<Record<string, unknown>>(id)!;
    ctx2.pub('*cfg/multiple', false);
    expect(container?.get(ConfigController).get('multiple')).toBe(false);
    expect(ctx.read('*cfg/multiple')).toBe(false);
  });

  it('deleteCtx destroys and unregisters the controller', () => {
    const id = freshCtx().id;
    PubSub.getCtx<Record<string, unknown>>(id)!.read('*cfg/multiple');
    expect(UploaderRegistry.get(id)).toBeDefined();

    PubSub.deleteCtx(id);
    expect(UploaderRegistry.get(id)).toBeUndefined();
  });

  it('non-config keys still use the nanostores store', () => {
    const ctx = freshCtx();
    expect(ctx.read('plain')).toBe('seed');

    const cb = vi.fn();
    ctx.sub('plain', cb, false);
    ctx.pub('plain', 'changed');

    expect(ctx.read('plain')).toBe('changed');
    expect(cb).toHaveBeenCalledWith('changed');
  });
});

describe('PubSub locale (*l10n/*) facade', () => {
  it('routes locale keys to the controller, not the nanostores store', () => {
    const ctx = freshCtx();
    expect(ctx.has('*l10n/upload')).toBe(false);

    ctx.add('*l10n/upload', 'Upload');

    expect(ctx.has('*l10n/upload')).toBe(true);
    expect(ctx.read('*l10n/upload')).toBe('Upload');
    expect('*l10n/upload' in ctx.store).toBe(false);
  });

  it('add() is first-write-wins; rewrite overwrites (LocaleManager seeding semantics)', () => {
    const ctx = freshCtx();
    ctx.add('*l10n/upload', 'Upload');

    ctx.add('*l10n/upload', 'Send'); // no rewrite — keeps
    expect(ctx.read('*l10n/upload')).toBe('Upload');

    ctx.add('*l10n/upload', 'Send', true); // rewrite (override / plugin l10n)
    expect(ctx.read('*l10n/upload')).toBe('Send');
  });

  it('sub fires on that key only, with per-key change semantics', () => {
    const ctx = freshCtx();
    ctx.add('*l10n/upload', 'Upload');
    const cb = vi.fn();
    ctx.sub('*l10n/upload', cb, false);

    ctx.add('*l10n/cancel', 'Cancel', true); // different key — no fire
    expect(cb).not.toHaveBeenCalled();

    ctx.add('*l10n/upload', 'Send', true);
    expect(cb).toHaveBeenLastCalledWith('Send');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('config and locale share one controller per ctx', () => {
    const ctx = freshCtx();
    const id = ctx.id;
    ctx.read('*cfg/multiple');
    ctx.add('*l10n/upload', 'Upload', true);

    const container = UploaderRegistry.get(id);
    expect(container?.get(LocaleController).get('upload')).toBe('Upload');
  });

  it('warns when reading a missing locale key but not a present one (typo surfacing)', () => {
    const ctx = freshCtx();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    ctx.read('*l10n/typoKey');
    expect(warn).toHaveBeenCalledWith('PubSub#read: Key "*l10n/typoKey" not found');

    warn.mockClear();
    ctx.add('*l10n/upload', 'Upload');
    ctx.read('*l10n/upload');
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});

describe('PubSub (additional coverage)', () => {
  it('pub routes a locale key to the controller', () => {
    const ctx = freshCtx();
    ctx.pub('*l10n/upload', 'Upload');
    expect(ctx.read('*l10n/upload')).toBe('Upload');
  });

  it('read warns for an unknown config key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = freshCtx();

    ctx.read('*cfg/totallyUnknownKey');

    expect(warn).toHaveBeenCalledWith('PubSub#read: Key "*cfg/totallyUnknownKey" not found');
    warn.mockRestore();
  });

  it('add for a non-facade key is first-write-wins and rewrites only on rewrite', () => {
    const ctx = freshCtx();
    ctx.add('extra', 'one');
    expect(ctx.read('extra')).toBe('one');

    ctx.add('extra', 'two'); // exists, no rewrite — kept
    expect(ctx.read('extra')).toBe('one');

    ctx.add('extra', 'two', true); // rewrite
    expect(ctx.read('extra')).toBe('two');
  });

  it('add() rewrite semantics pin what ctxOwner buys: first-write-wins normally, force-overwrite when rewrite=true (CloudImageEditorBlock/EditorImageCropper init$ seeding path)', () => {
    // `SymbioteCompatMixin._initSharedContext` calls `add(key, defaultValue,
    // this.ctxOwner)` for every `init$` key on connect (src/lit/SymbioteCompatMixin.ts).
    // `CloudImageEditorBlock` (16 keys via `createCloudImageEditorState()`, CloudImageEditorBlock.ts:120-123)
    // and `EditorImageCropper` (4 keys seeded in its constructor, EditorImageCropper.ts:65-85)
    // are the only two classes that set `ctxOwner = true`, so for their real
    // seeded keys `add` is called with `rewrite=true` instead of the default
    // `false`. This pins that the two rewrite values genuinely differ — not
    // that a collision currently exists (none does; no other co-resident
    // block seeds the same keys today, so the rewrite is presently inert in
    // practice, just live in mechanism).
    const ctx = freshCtx();

    ctx.add('*imageBox', 'v1'); // non-owner seeding: rewrite=false (default)
    ctx.add('*imageBox', 'v2'); // a second non-owner seed — first-write-wins
    expect(ctx.read('*imageBox')).toBe('v1');

    ctx.add('*imageBox', 'v3', true); // ctxOwner=true path — forces overwrite
    expect(ctx.read('*imageBox')).toBe('v3');
  });

  it('pub warns for an unknown non-facade key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = freshCtx();

    ctx.pub('missingKey', 'v');

    expect(warn).toHaveBeenCalledWith('PubSub#pub: Key "missingKey" not found');
    warn.mockRestore();
  });

  it('has() routes namespaces and falls back to the nanostores store', () => {
    const ctx = freshCtx();
    expect(ctx.has('plain')).toBe(true); // non-facade key present in the store
    expect(ctx.has('absent')).toBe(false);
  });

  it('registerCtx throws on a duplicate ctx id', () => {
    const ctx = freshCtx();
    expect(() => PubSub.registerCtx({}, ctx.id)).toThrow(/already exists/);
  });

  it('getCtx returns null for an unknown ctx; hasCtx reflects existence', () => {
    const ctx = freshCtx();
    expect(PubSub.getCtx('does-not-exist')).toBeNull();
    expect(PubSub.hasCtx(ctx.id)).toBe(true);
    expect(PubSub.hasCtx('does-not-exist')).toBe(false);
  });

  it('deleteCtx is a no-op for the container when none was created', () => {
    const ctx = freshCtx();
    // Never touched a *cfg/ or *l10n/ key, so no container exists.
    expect(() => PubSub.deleteCtx(ctx.id)).not.toThrow();
    expect(PubSub.hasCtx(ctx.id)).toBe(false);
  });

  it('reusing the same ctx id after a full teardown rebuilds a brand-new container, not the destroyed one', () => {
    const id = freshCtx().id;
    const firstCtx = PubSub.getCtx<Record<string, unknown>>(id)!;
    firstCtx.pub('*cfg/multiple', false); // mutate away from the default
    const firstContainer = UploaderRegistry.get(id);
    expect(firstContainer).toBeDefined();

    PubSub.deleteCtx(id);
    expect(PubSub.hasCtx(id)).toBe(false);
    expect(UploaderRegistry.get(id)).toBeUndefined();

    // Same id, re-registered — the container-owned managers must not survive
    // under a stale reference keyed by ctx id; a fresh registration must get a
    // fresh container.
    const secondCtx = PubSub.registerCtx<Record<string, unknown>>({ plain: 'seed' }, id);
    secondCtx.read('*cfg/multiple'); // triggers lazy container (re-)creation
    const secondContainer = UploaderRegistry.get(id);

    expect(secondContainer).toBeDefined();
    expect(secondContainer).not.toBe(firstContainer);
    // Fresh defaults — no leakage of the mutated value from the destroyed ctx.
    expect(secondCtx.read('*cfg/multiple')).toBe(initialConfig.multiple);
  });

  it('deleteCtx orders: ctx removal, then UploaderRegistry unregister (null-notify), then container.dispose()', () => {
    const ctx = freshCtx();
    const id = ctx.id;
    ctx.read('*cfg/multiple'); // triggers lazy container creation
    const container = UploaderRegistry.get(id)!;

    const callOrder: string[] = [];
    const disposeSpy = vi.spyOn(container, 'dispose');

    // `whenAvailable` fires synchronously with `null` from inside
    // `UploaderRegistry.unregister` — record what the ctx/container state
    // looks like at that exact moment.
    const unsub = UploaderRegistry.whenAvailable(id, (c) => {
      if (c === null) {
        callOrder.push('unregister-null-notify');
        expect(PubSub.hasCtx(id)).toBe(false); // ctx already gone by this point
        expect(disposeSpy).not.toHaveBeenCalled(); // container not yet disposed
      }
    });

    disposeSpy.mockImplementation(() => {
      callOrder.push('container.dispose');
    });

    PubSub.deleteCtx(id);
    unsub();

    expect(callOrder).toEqual(['unregister-null-notify', 'container.dispose']);
  });
});

describe('PubSub (M9k/M9l Task 3: pre-connect construction timing)', () => {
  it('touching a *cfg/* key before any element connects builds all six container-owned managers, with no global side effects', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    // Bare ctx + a config read — no `<uc-config>`/`LitBlock` ever touches this
    // ctx, matching the M9k Task 2 shift: the container (and its owned managers)
    // now come into being the moment *any* `*cfg/*`/`*l10n/*` key is touched,
    // not when a DOM element's `initCallback` runs. M9l Task 2's lazy-arm split
    // (a11y/clipboard attach zero window listeners at construction, only on
    // first registration) is what makes constructing them this early safe.
    try {
      const ctx = freshCtx();
      expect(() => ctx.read('*cfg/multiple')).not.toThrow();

      const container = UploaderRegistry.get(ctx.id);
      expect(container).toBeDefined();
      expect(container!.get(LocaleManager)).toBeInstanceOf(LocaleManager);
      expect(container!.get(EventEmitter)).toBeInstanceOf(EventEmitter);
      expect(container!.get(TelemetryManager)).toBeInstanceOf(TelemetryManager);
      expect(container!.get(RouterController)).toBeInstanceOf(RouterController);
      expect(container!.get(A11y)).toBeInstanceOf(A11y);
      expect(container!.get(ClipboardController)).toBeInstanceOf(ClipboardController);

      // Nothing on this path reaches into the DOM/global scope. The ctx
      // itself never sees `*a11y`/`*clipboard` — those v1 shared-instance
      // keys are only registered by `ensureUploaderCtx` (element-triggered),
      // and this ctx never had a block connect — even though the container now
      // constructs both instances eagerly alongside the rest.
      expect(ctx.has('*a11y')).toBe(false);
      expect(ctx.has('*clipboard')).toBe(false);

      expect(addEventListenerSpy).not.toHaveBeenCalled();
    } finally {
      addEventListenerSpy.mockRestore();
    }
  });
});

describe('PubSub (M-god step 2/8e: per-ctx ControllerContainer ownership)', () => {
  it('the per-ctx container is disposed exactly once on ctx teardown', () => {
    const ctx = freshCtx();
    const id = ctx.id;
    const container = ctx.container(); // lazily creates + registers the container

    const disposeSpy = vi.spyOn(container, 'dispose');

    PubSub.deleteCtx(id);
    // deleteCtx disposes the container once (which destroys its controllers).
    expect(disposeSpy).toHaveBeenCalledTimes(1);

    // A second teardown of the same (already-removed) ctx must NOT dispose again.
    PubSub.deleteCtx(id);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it('per-ctx identity: the same ctx yields one container across repeated resolution; a different ctx yields a different one', () => {
    const ctxA = freshCtx();
    const ctxB = freshCtx();

    const a1 = ctxA.container();
    const a2 = ctxA.container();
    // A fresh wrapper for the same ctx id resolves the same container.
    const a3 = PubSub.getCtx<Record<string, unknown>>(ctxA.id)!.container();
    const b1 = ctxB.container();

    expect(a1).toBe(a2);
    expect(a1).toBe(a3);
    expect(b1).not.toBe(a1);
  });

  it('the instance registered in UploaderRegistry is the ctx ControllerContainer (M-god step 8e)', () => {
    const ctx = freshCtx();
    ctx.container(); // triggers container creation + registration

    const registered = UploaderRegistry.get(ctx.id);
    expect(registered).toBeInstanceOf(ControllerContainer);
    // It is the exact container instance the ctx resolves.
    expect(registered).toBe(ctx.container());
  });

  // M-god step 8e moved the eager-construction set off the deleted
  // `UploaderController` ctor onto `_resolveContainer`. It must still fire on
  // EVERY container-creation path (here: a bare `*cfg/*` touch), so the managers
  // with construction/init side effects exist from birth — telemetry in
  // particular must subscribe to the bus before any event can fire.
  it('eagerly constructs the config/router/telemetry set on container creation (no consumer get needed)', () => {
    const ctx = freshCtx();
    ctx.read('*cfg/multiple'); // first *cfg/* touch → creates + registers the container
    const container = UploaderRegistry.get(ctx.id)!;

    // `has()` is true only for already-constructed tokens — these three are
    // resolved by `_resolveContainer` itself, without any consumer `get()`.
    expect(container.has(ConfigController)).toBe(true);
    expect(container.has(RouterController)).toBe(true);
    expect(container.has(TelemetryManager)).toBe(true);
  });

  it('the eagerly-constructed telemetry observes the ctx bus (init() ran at container creation)', () => {
    const ctx = freshCtx();
    ctx.read('*cfg/multiple'); // build the container; telemetry is constructed eagerly
    const container = UploaderRegistry.get(ctx.id)!;
    // Resolve the ALREADY-constructed instances (identity is stable; no re-init).
    const telemetry = container.get(TelemetryManager);
    const sendEvent = vi.spyOn(telemetry, 'sendEvent');

    // Emitting on the ctx bus reaches telemetry only if its `init()` subscribed
    // at construction — proving the eager set wired the bus observer.
    container.get(EventEmitter).emit(UploaderEventType.UPLOAD_CLICK);

    expect(sendEvent).toHaveBeenCalled();
  });
});

describe('PubSub collection-state (M-god step 4) facade', () => {
  it('reads the seeded defaults from the controller, not the nanostores store', () => {
    const ctx = freshCtx();
    expect(ctx.read('*uploadList')).toEqual([]);
    expect(ctx.read('*commonProgress')).toBe(0);
    expect(ctx.read('*collectionState')).toBeNull();
    expect(ctx.read('*collectionErrors')).toEqual([]);
    expect(ctx.read('*groupInfo')).toBeNull();
    expect(ctx.read('*uploadTrigger')).toBeInstanceOf(Set);
    // Routed away from the raw store (the store is seeded with `{ plain }` only).
    expect('*uploadList' in ctx.store).toBe(false);
  });

  it('round-trips a write through the controller', () => {
    const ctx = freshCtx();
    ctx.pub('*commonProgress', 55);
    expect(ctx.read('*commonProgress')).toBe(55);
  });

  it('sub fires immediately (init) then on subsequent changes to that key', () => {
    const ctx = freshCtx();
    const cb = vi.fn();
    ctx.sub('*commonProgress', cb, true);
    expect(cb).toHaveBeenLastCalledWith(0);

    ctx.pub('*commonProgress', 33);
    expect(cb).toHaveBeenLastCalledWith(33);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('per-key granularity: a *commonProgress write does NOT fire a *uploadList subscriber', () => {
    const ctx = freshCtx();
    const listCb = vi.fn();
    const progressCb = vi.fn();
    ctx.sub('*uploadList', listCb, false);
    ctx.sub('*commonProgress', progressCb, false);

    ctx.pub('*commonProgress', 70);

    expect(progressCb).toHaveBeenCalledTimes(1);
    expect(listCb).not.toHaveBeenCalled(); // the exact _subDerived Object.is trap

    ctx.pub('*uploadList', [{ uid: 'x' }]);
    expect(listCb).toHaveBeenCalledTimes(1);
    expect(progressCb).toHaveBeenCalledTimes(1); // still not re-fired
  });

  it('*uploadTrigger dedup is by reference: replacing fires the sub, mutating in place does not', () => {
    const ctx = freshCtx();
    const cb = vi.fn();
    ctx.sub('*uploadTrigger', cb, false);

    ctx.pub('*uploadTrigger', new Set(['a']));
    expect(cb).toHaveBeenCalledTimes(1);

    // Mutating the live set in place (as UploadEventsController does) — no fire.
    (ctx.read('*uploadTrigger') as Set<string>).delete('a');
    expect(cb).toHaveBeenCalledTimes(1);

    ctx.pub('*uploadTrigger', new Set(['b'])); // new reference
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('the 9-stateBridges path shares the same CollectionStateController instance the reads see', () => {
    const ctx = freshCtx();
    // Force the container (which owns the CollectionStateController the
    // stateBridges read/write over this ctx's pub/read) into existence.
    ctx.container();
    // A read through the facade and a write through the facade hit one instance.
    ctx.pub('*collectionState', { totalCount: 3 } as never);
    expect(ctx.read('*collectionState')).toEqual({ totalCount: 3 });
  });

  it('has() falls through to the store seed (v1 parity): false on a plain ctx, true when seeded', () => {
    const plain = freshCtx();
    // A plain ctx (store seeded with `{ plain }` only) — the collection keys
    // are the value-source of the controller but `has` reflects store seeding.
    expect(plain.has('*uploadList')).toBe(false);

    const id = `pubsub-test-${seq++}`;
    ids.push(id);
    const seeded = PubSub.registerCtx<Record<string, unknown>>({ '*uploadList': [] }, id);
    expect(seeded.has('*uploadList')).toBe(true);
  });

  it('add() is first-write-wins and overwrites only on rewrite', () => {
    const ctx = freshCtx();
    ctx.pub('*commonProgress', 12);

    ctx.add('*commonProgress', 99); // no rewrite — keeps
    expect(ctx.read('*commonProgress')).toBe(12);

    ctx.add('*commonProgress', 99, true); // rewrite
    expect(ctx.read('*commonProgress')).toBe(99);
  });
});

describe('PubSub *lazyPlugins (M-god step 4) facade', () => {
  it('seeds to null and routes reads away from the nanostores store', () => {
    const ctx = freshCtx();
    expect(ctx.read('*lazyPlugins')).toBeNull();
    // `has` falls through to the store seed (v1 parity) — plain ctx, not seeded.
    expect(ctx.has('*lazyPlugins')).toBe(false);
    expect('*lazyPlugins' in ctx.store).toBe(false);
  });

  it('pub/sub round-trips (SolutionChildBlock pub → LazyPluginLoader sub)', () => {
    const ctx = freshCtx();
    const cb = vi.fn();
    ctx.sub('*lazyPlugins', cb, false);

    const entries = [{ configDeps: [], isEnabled: () => true, load: () => undefined }];
    ctx.pub('*lazyPlugins', entries);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(ctx.read('*lazyPlugins')).toBe(entries);
  });

  it('add() rewrite semantics', () => {
    const ctx = freshCtx();
    const a = [{ configDeps: [], isEnabled: () => true, load: () => undefined }];
    const b = [{ configDeps: [], isEnabled: () => false, load: () => undefined }];

    ctx.add('*lazyPlugins', a); // seeded to null → first-write-wins keeps null (rewrite=false)
    expect(ctx.read('*lazyPlugins')).toBeNull();

    ctx.add('*lazyPlugins', b, true); // rewrite
    expect(ctx.read('*lazyPlugins')).toBe(b);
  });
});

describe('PubSub collection-state ownership', () => {
  it('deleteCtx disposes the CollectionStateController + LazyPluginsController with the container', () => {
    const ctx = freshCtx();
    const id = ctx.id;
    ctx.pub('*commonProgress', 5);
    ctx.pub('*lazyPlugins', [{ configDeps: [], isEnabled: () => true, load: () => undefined }]);

    // A fresh wrapper for the same ctx sees the same collection/lazy state.
    const ctx2 = PubSub.getCtx<Record<string, unknown>>(id)!;
    expect(ctx2.read('*commonProgress')).toBe(5);

    PubSub.deleteCtx(id);

    // Re-registering the same id yields fresh, default state (no leak).
    const ctx3 = PubSub.registerCtx<Record<string, unknown>>({ plain: 'seed' }, id);
    expect(ctx3.read('*commonProgress')).toBe(0);
    expect(ctx3.read('*lazyPlugins')).toBeNull();
  });
});

describe('PubSub.whenCtx', () => {
  const nextId = () => {
    const id = `pubsub-test-${seq++}`;
    ids.push(id);
    return id;
  };

  it('fires synchronously when the ctx already exists', () => {
    const id = nextId();
    PubSub.registerCtx<Record<string, unknown>>({ plain: 'seed' }, id);
    const cb = vi.fn();
    PubSub.whenCtx(id, cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('fires on a microtask (not re-entrantly) when the ctx is created later', async () => {
    const id = nextId();
    const cb = vi.fn();
    PubSub.whenCtx(id, cb);
    expect(cb).not.toHaveBeenCalled();
    PubSub.registerCtx<Record<string, unknown>>({ plain: 'seed' }, id);
    expect(cb).not.toHaveBeenCalled(); // deferred, NOT synchronous inside registerCtx
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('cancel before creation prevents firing', async () => {
    const id = nextId();
    const cb = vi.fn();
    PubSub.whenCtx(id, cb)();
    PubSub.registerCtx<Record<string, unknown>>({ plain: 'seed' }, id);
    await Promise.resolve();
    expect(cb).not.toHaveBeenCalled();
  });

  it('cancel AFTER registerCtx schedules but BEFORE the microtask still prevents firing', async () => {
    const id = nextId();
    const cb = vi.fn();
    const cancel = PubSub.whenCtx(id, cb);
    PubSub.registerCtx<Record<string, unknown>>({ plain: 'seed' }, id); // schedules the microtask
    cancel(); // race: cancel before the microtask runs
    await Promise.resolve();
    expect(cb).not.toHaveBeenCalled();
  });
});
