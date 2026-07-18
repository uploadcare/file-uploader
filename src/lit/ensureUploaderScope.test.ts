import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SecureUploadsController } from '../abstract/controllers/SecureUploadsController';
import { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import { UploadController } from '../abstract/controllers/UploadController';
import { UploadEventsController } from '../abstract/controllers/UploadEventsController';
import { ValidationController } from '../abstract/controllers/ValidationController';
import type { Token } from '../abstract/di/ControllerContainer';
import { PluginController } from '../abstract/managers/plugin';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import { ensureUploaderCtx } from './ensureUploaderCtx';
import { ensureUploaderScope } from './ensureUploaderScope';

// M-god step 9c: `ensureUploaderScope` takes the ctx's `ControllerContainer`
// directly (the v1 ctx/`bag` layer is gone). It resolves the upload stack, the
// public API, and the plugin manager off the container. These specs pin that
// wiring + idempotency.

let seq = 0;
const created: string[] = [];
let warnSpy: ReturnType<typeof vi.spyOn>;

const setup = () => {
  const ctxName = `ensure-scope-test-${seq++}`;
  const container = ensureUploaderCtx(ctxName);
  created.push(ctxName);
  const eventEmitter = container.get(EventEmitter);
  const attach = () =>
    ensureUploaderScope(container, undefined, (type, payload, options) => eventEmitter.emit(type, payload, options));
  return { ctxName, container, attach };
};

beforeEach(() => {
  // Keep console output clean, but don't blanket-swallow: these specs expect NO
  // warning, so the afterEach asserts the spy stayed silent — a real
  // isolate-and-warn (e.g. a controller `init()`/`destroy()` throwing) surfaces
  // as a test failure instead of being hidden.
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  const warnings = warnSpy.mock.calls;
  vi.restoreAllMocks();
  for (const name of created.splice(0)) {
    UploaderRegistry.dispose(name);
  }
  expect(warnings).toEqual([]);
});

describe('ensureUploaderScope (container signature)', () => {
  it('resolves the container-owned upload scope controllers', () => {
    const { container, attach } = setup();
    expect(container.has(UploadCollectionController)).toBe(false);
    expect(container.has(UploaderPublicApi)).toBe(false);

    attach();

    const tokens: Token<unknown>[] = [
      UploadCollectionController,
      UploaderPublicApi,
      SecureUploadsController,
      UploadController,
      ValidationController,
      UploadEventsController,
      PluginController,
    ];
    for (const token of tokens) {
      expect(container.has(token)).toBe(true);
    }
  });

  it('is idempotent — a second attach keeps the first-resolved instances', () => {
    const { container, attach } = setup();
    attach();
    const collection = container.get(UploadCollectionController);
    const api = container.get(UploaderPublicApi);
    const pluginManager = container.get(PluginController);

    attach();

    expect(container.get(UploadCollectionController)).toBe(collection);
    expect(container.get(UploaderPublicApi)).toBe(api);
    expect(container.get(PluginController)).toBe(pluginManager);
  });

  it('registers a public api whose getOutputCollectionState resolves off its container', () => {
    const { container, attach } = setup();
    attach();
    const api = container.get(UploaderPublicApi);
    // M-god step 9c-1: no `setBagBridge` — the api resolves the derived-collection
    // controllers from its own `CONTAINER`-tagged container, so a bare call
    // resolves without any bag wiring.
    expect(() => api.getOutputCollectionState()).not.toThrow();
  });
});
