import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import { PluginController } from '../abstract/managers/plugin';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import { ensureUploaderCtx } from './ensureUploaderCtx';
import { ensureUploaderScope } from './ensureUploaderScope';
import { PubSub } from './PubSubCompat';
import type { SharedState } from './SharedState';

// M-god step 9b-1: `ensureUploaderScope` takes the ctx's `PubSub` + its
// `ControllerContainer` directly (was the `bag`), builds its residual bag
// internally, resolves the upload stack off the container, and re-exposes the
// instances under their v1 `*`-keys. These specs pin that wiring + idempotency.

let seq = 0;
const created: string[] = [];

const setup = () => {
  const ctxName = `ensure-scope-test-${seq++}`;
  const ctx = ensureUploaderCtx(ctxName);
  created.push(ctxName);
  const container = ctx.container();
  const eventEmitter = container.get(EventEmitter);
  const attach = () =>
    ensureUploaderScope(ctx, container, undefined, (type, payload, options) =>
      eventEmitter.emit(type, payload, options),
    );
  return { ctxName, ctx, container, attach };
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const name of created.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

describe('ensureUploaderScope (ctx + container signature)', () => {
  it('re-exposes the container-owned upload scope under the v1 *-keys', () => {
    const { ctx, attach } = setup();
    expect(ctx.has('*uploadCollection')).toBe(false);
    expect(ctx.has('*publicApi')).toBe(false);

    attach();

    for (const key of [
      '*uploadCollection',
      '*publicApi',
      '*secureUploadsManager',
      '*uploadController',
      '*validationManager',
      '*uploadEvents',
      '*pluginManager',
    ] as const) {
      expect(ctx.has(key)).toBe(true);
    }
  });

  it('re-exposes the SAME container singletons under the *-keys', () => {
    const { ctx, container, attach } = setup();
    attach();

    expect(ctx.read('*uploadCollection')).toBe(container.get(UploadCollectionController));
    expect(ctx.read('*publicApi')).toBe(container.get(UploaderPublicApi));
    expect(ctx.read('*pluginManager')).toBe(container.get(PluginController));
  });

  it('is idempotent — a second attach keeps the first-write-wins instances', () => {
    const { ctx, attach } = setup();
    attach();
    const collection = ctx.read('*uploadCollection');
    const api = ctx.read('*publicApi');

    attach();

    expect(ctx.read('*uploadCollection')).toBe(collection);
    expect(ctx.read('*publicApi')).toBe(api);
  });

  it('registers a public api whose getOutputCollectionState resolves off its container', () => {
    const { ctx, attach } = setup();
    attach();
    const api = ctx.read('*publicApi') as SharedState['*publicApi'];
    // M-god step 9c-1: no `setBagBridge` — the api resolves the derived-collection
    // controllers from its own `CONTAINER`-tagged container, so a bare call
    // resolves without any bag wiring.
    expect(() => api?.getOutputCollectionState()).not.toThrow();
  });
});
