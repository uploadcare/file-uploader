import { afterEach, describe, expect, it } from 'vitest';
import { UploaderController } from '../abstract/controllers/UploaderController';
import { localeStateKey } from '../abstract/managers/LocaleManager';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { ensureUploaderCtx } from './ensureUploaderCtx';
import { PubSub } from './PubSubCompat';

// Each test uses a unique ctx id and tears it down so the module-level
// context/controller maps and the global UploaderRegistry don't leak.
let seq = 0;
const ids: string[] = [];
const freshCtxName = () => {
  const id = `ensure-uploader-ctx-test-${seq++}`;
  ids.push(id);
  return id;
};

afterEach(() => {
  for (const id of ids.splice(0)) PubSub.deleteCtx(id);
});

describe('ensureUploaderCtx', () => {
  it('creates the ctx map pre-any-element, with no DOM/Lit block ever having touched it', () => {
    const ctxName = freshCtxName();
    expect(PubSub.hasCtx(ctxName)).toBe(false);

    const ctx = ensureUploaderCtx(ctxName);

    expect(PubSub.hasCtx(ctxName)).toBe(true);
    expect(ctx.id).toBe(ctxName);
  });

  it('seeds the full plain uploader/solution state set (blockCtx + uploaderBlockCtx + solutionBlockCtx)', () => {
    const ctxName = freshCtxName();
    const ctx = ensureUploaderCtx(ctxName);

    expect(ctx.read('*commonProgress')).toBe(0);
    expect(ctx.read('*uploadList')).toEqual([]);
    expect(ctx.read('*collectionErrors')).toEqual([]);
    expect(ctx.read('*collectionState')).toBeNull();
    expect(ctx.read('*groupInfo')).toBeNull();
    expect(ctx.read('*uploadTrigger')).toEqual(new Set());
    expect(ctx.read('*lazyPlugins')).toBeNull();
  });

  it('seeds the six controller-owned re-exposer keys, but not the v1-element-gated ones (M9q Task 2)', () => {
    const ctxName = freshCtxName();
    const ctx = ensureUploaderCtx(ctxName);
    const controller = UploaderRegistry.get(ctxName)!;

    // The six keys this seam now registers itself — identity-pinned against
    // the controller's own instances, same recipe as `LitBlock`'s re-exposers.
    expect(ctx.read('*eventEmitter')).toBe(controller.eventEmitter);
    expect(ctx.read('*localeManager')).toBe(controller.localeManager);
    expect(ctx.read('*a11y')).toBe(controller.a11y);
    expect(ctx.read('*router')).toBe(controller.router);
    expect(ctx.read('*clipboard')).toBe(controller.clipboard);
    expect(ctx.read('*telemetryManager')).toBe(controller.telemetryManager);

    // Still v1-element-gated — never registered by this v1-free seam.
    expect(ctx.has('*pluginManager')).toBe(false);
    expect(ctx.has('*uploadCollection')).toBe(false);
  });

  it('activates LocaleManager with a null plugin manager (no *pluginManager registered in this v1-free seam)', () => {
    const ctxName = freshCtxName();
    const ctx = ensureUploaderCtx(ctxName);

    // `LocaleManager.activate` seeds the `en` dictionary unconditionally —
    // proves `activate` actually ran, not just that the manager exists.
    expect(ctx.read(localeStateKey('upload-file'))).toBe('Upload file');
  });

  it('forces the UploaderController into existence immediately, not lazily on first *cfg/*l10n touch', () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);

    const controller = UploaderRegistry.get(ctxName);
    expect(controller).toBeInstanceOf(UploaderController);
  });

  it('is idempotent: a second call against an existing ctx returns the same ctx/controller, untouched', () => {
    const ctxName = freshCtxName();
    const first = ensureUploaderCtx(ctxName);
    const firstController = UploaderRegistry.get(ctxName);

    // Mutate a seeded value to prove idempotency doesn't re-seed over it.
    first.pub('*commonProgress', 42);

    const second = ensureUploaderCtx(ctxName);
    const secondController = UploaderRegistry.get(ctxName);

    expect(second.id).toBe(first.id);
    expect(secondController).toBe(firstController);
    // No re-seed clobber of the live value set above.
    expect(second.read('*commonProgress')).toBe(42);
  });

  it('gives each ctx its own fresh mutable seed instances (no shared Set across ctxs)', () => {
    const ctxNameA = freshCtxName();
    const ctxNameB = freshCtxName();
    const ctxA = ensureUploaderCtx(ctxNameA);
    const ctxB = ensureUploaderCtx(ctxNameB);

    expect(ctxA.read('*uploadTrigger')).not.toBe(ctxB.read('*uploadTrigger'));

    ctxA.read('*uploadTrigger').add('abc' as never);
    expect(ctxB.read('*uploadTrigger').size).toBe(0);
  });

  it('when a ctx already exists (e.g. registered by a plain nanostores caller), reuses it as-is without forcing a re-seed', () => {
    const ctxName = freshCtxName();
    const preexisting = PubSub.registerCtx<Record<string, unknown>>({ plain: 'seed' }, ctxName);

    const ctx = ensureUploaderCtx(ctxName);

    expect(ctx.id).toBe(preexisting.id);
    expect(ctx.read('plain' as never)).toBe('seed');
    // The full uploader/solution seed set was NOT retroactively injected —
    // the seam only seeds on first creation, never on an existing map.
    expect(ctx.has('*commonProgress')).toBe(false);
  });

  // Pin ahead of M9o Task 2 (ChildBlock._watchRegistry calling this function
  // to self-bootstrap a ctx): a pre-existing map with no controller yet (the
  // exact shape a bare `PubSub.registerCtx` caller leaves behind) must still
  // get a controller forced into the registry — every path through this
  // function, not just first-creation, is a controller-existence guarantee.
  it('forces a controller into existence when the ctx map pre-exists WITHOUT one', () => {
    const ctxName = freshCtxName();
    PubSub.registerCtx<Record<string, unknown>>({ plain: 'seed' }, ctxName);
    expect(UploaderRegistry.get(ctxName)).toBeUndefined();

    ensureUploaderCtx(ctxName);

    expect(UploaderRegistry.get(ctxName)).toBeInstanceOf(UploaderController);
  });
});
