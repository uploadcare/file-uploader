import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClipboardController } from '../abstract/controllers/ClipboardController';
import { RouterController } from '../abstract/controllers/RouterController';
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

    const controller = UploaderRegistry.get(id);
    expect(controller).toBeDefined();

    // A second wrapper for the same ctx sees the same config state.
    const ctx2 = PubSub.getCtx<Record<string, unknown>>(id)!;
    ctx2.pub('*cfg/multiple', false);
    expect(controller?.config.get('multiple')).toBe(false);
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

    const controller = UploaderRegistry.get(id);
    expect(controller?.locale.get('upload')).toBe('Upload');
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

  it('deleteCtx is a no-op for the controller when none was created', () => {
    const ctx = freshCtx();
    // Never touched a *cfg/ or *l10n/ key, so no UploaderController exists.
    expect(() => PubSub.deleteCtx(ctx.id)).not.toThrow();
    expect(PubSub.hasCtx(ctx.id)).toBe(false);
  });

  it('reusing the same ctx id after a full teardown rebuilds a brand-new controller, not the destroyed one', () => {
    const id = freshCtx().id;
    const firstCtx = PubSub.getCtx<Record<string, unknown>>(id)!;
    firstCtx.pub('*cfg/multiple', false); // mutate away from the default
    const firstController = UploaderRegistry.get(id);
    expect(firstController).toBeDefined();

    PubSub.deleteCtx(id);
    expect(PubSub.hasCtx(id)).toBe(false);
    expect(UploaderRegistry.get(id)).toBeUndefined();

    // Same id, re-registered — the controller-owned managers this milestone
    // moves onto UploaderController must not survive under a stale reference
    // keyed by ctx id; a fresh registration must get a fresh controller.
    const secondCtx = PubSub.registerCtx<Record<string, unknown>>({ plain: 'seed' }, id);
    secondCtx.read('*cfg/multiple'); // triggers lazy controller (re-)creation
    const secondController = UploaderRegistry.get(id);

    expect(secondController).toBeDefined();
    expect(secondController).not.toBe(firstController);
    // Fresh defaults — no leakage of the mutated value from the destroyed ctx.
    expect(secondCtx.read('*cfg/multiple')).toBe(initialConfig.multiple);
  });

  it('deleteCtx orders: ctx removal, then UploaderRegistry unregister (null-notify), then controller.destroy()', () => {
    const ctx = freshCtx();
    const id = ctx.id;
    ctx.read('*cfg/multiple'); // triggers lazy controller creation
    const controller = UploaderRegistry.get(id)!;

    const callOrder: string[] = [];
    const destroySpy = vi.spyOn(controller, 'destroy');

    // `whenAvailable` fires synchronously with `null` from inside
    // `UploaderRegistry.unregister` — record what the ctx/controller state
    // looks like at that exact moment.
    const unsub = UploaderRegistry.whenAvailable(id, (c) => {
      if (c === null) {
        callOrder.push('unregister-null-notify');
        expect(PubSub.hasCtx(id)).toBe(false); // ctx already gone by this point
        expect(destroySpy).not.toHaveBeenCalled(); // controller not yet destroyed
      }
    });

    destroySpy.mockImplementation(() => {
      callOrder.push('controller.destroy');
    });

    PubSub.deleteCtx(id);
    unsub();

    expect(callOrder).toEqual(['unregister-null-notify', 'controller.destroy']);
  });
});

describe('PubSub (M9k/M9l Task 3: pre-connect construction timing)', () => {
  it('touching a *cfg/* key before any element connects builds all six controller-owned managers, with no global side effects', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    // Bare ctx + a config read — no `<uc-config>`/`LitBlock` ever touches this
    // ctx, matching the M9k Task 2 shift: the controller (and its owned
    // managers) now come into being the moment *any* `*cfg/*`/`*l10n/*` key is
    // touched, not when a DOM element's `initCallback` runs. M9l Task 2's
    // lazy-arm split (a11y/clipboard attach zero window listeners at
    // construction, only on first registration) is what makes constructing
    // them this early safe.
    try {
      const ctx = freshCtx();
      expect(() => ctx.read('*cfg/multiple')).not.toThrow();

      const controller = UploaderRegistry.get(ctx.id);
      expect(controller).toBeDefined();
      expect(controller!.localeManager).toBeInstanceOf(LocaleManager);
      expect(controller!.eventEmitter).toBeInstanceOf(EventEmitter);
      expect(controller!.telemetryManager).toBeInstanceOf(TelemetryManager);
      expect(controller!.router).toBeInstanceOf(RouterController);
      expect(controller!.a11y).toBeInstanceOf(A11y);
      expect(controller!.clipboard).toBeInstanceOf(ClipboardController);

      // Nothing on this path reaches into the DOM/global scope. The ctx
      // itself never sees `*a11y`/`*clipboard` — those v1 shared-instance
      // keys are only registered by `LitBlock.initCallback` (element-
      // triggered), and this ctx never had a block connect — even though the
      // controller now constructs both instances eagerly alongside the rest.
      expect(ctx.has('*a11y')).toBe(false);
      expect(ctx.has('*clipboard')).toBe(false);

      expect(addEventListenerSpy).not.toHaveBeenCalled();
    } finally {
      addEventListenerSpy.mockRestore();
    }
  });
});
