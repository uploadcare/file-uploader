import { afterEach, describe, expect, it } from 'vitest';
import { ClipboardController } from '../abstract/controllers/ClipboardController';
import { ConfigController } from '../abstract/controllers/ConfigController';
import { LocaleController } from '../abstract/controllers/LocaleController';
import { RouterController } from '../abstract/controllers/RouterController';
import { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import { ControllerContainer } from '../abstract/di/ControllerContainer';
import { A11y } from '../abstract/managers/a11y';
import { LocaleManager } from '../abstract/managers/LocaleManager';
import { PluginController } from '../abstract/managers/plugin';
import { TelemetryManager } from '../abstract/managers/TelemetryManager';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import { ensureUploaderCtx } from './ensureUploaderCtx';

// Each test uses a unique ctx id and tears it down so the global
// UploaderRegistry doesn't leak.
let seq = 0;
const ids: string[] = [];
const freshCtxName = () => {
  const id = `ensure-uploader-ctx-test-${seq++}`;
  ids.push(id);
  return id;
};

afterEach(() => {
  for (const id of ids.splice(0)) UploaderRegistry.dispose(id);
});

describe('ensureUploaderCtx', () => {
  it("creates and returns the ctx's ControllerContainer pre-any-element", () => {
    const ctxName = freshCtxName();
    expect(UploaderRegistry.get(ctxName)).toBeUndefined();

    const container = ensureUploaderCtx(ctxName);

    expect(container).toBeInstanceOf(ControllerContainer);
    expect(UploaderRegistry.get(ctxName)).toBe(container);
  });

  it('eagerly constructs the ctx-scoped managers at ctx creation', () => {
    const ctxName = freshCtxName();
    const container = ensureUploaderCtx(ctxName);

    // These were previously the six `*`-key re-exposers; now they are eagerly
    // resolved container instances (constructed the moment the ctx exists).
    expect(container.has(EventEmitter)).toBe(true);
    expect(container.has(LocaleManager)).toBe(true);
    expect(container.has(A11y)).toBe(true);
    expect(container.has(RouterController)).toBe(true);
    expect(container.has(TelemetryManager)).toBe(true);
  });

  it('does NOT eagerly construct the uploader-scope / plugin controllers (those are attached by ensureUploaderScope)', () => {
    const ctxName = freshCtxName();
    const container = ensureUploaderCtx(ctxName);

    expect(container.has(PluginController)).toBe(false);
    expect(container.has(UploadCollectionController)).toBe(false);
    // `ClipboardController` has no construction-time side effect (its paste
    // listener arms lazily on the first registered scope) and scopes are only
    // registered per-solution by `SolutionChildBlock`. Keeping it out of this
    // shared seam keeps it out of the editor-alone bundle's static graph.
    expect(container.has(ClipboardController)).toBe(false);
  });

  it('activates LocaleManager with a null plugin manager (no PluginController in this v1-free seam)', () => {
    const ctxName = freshCtxName();
    const container = ensureUploaderCtx(ctxName);

    // `LocaleManager.activate` seeds the `en` dictionary unconditionally into the
    // ctx's `LocaleController` — proves `activate` actually ran, not just that the
    // manager exists — and tolerates the absent `PluginController`.
    expect(container.get(LocaleController).get('upload-file')).toBe('Upload file');
  });

  it('is idempotent: a second call returns the same container, untouched', () => {
    const ctxName = freshCtxName();
    const first = ensureUploaderCtx(ctxName);

    // Mutate a controller value to prove idempotency doesn't re-init over it.
    first.get(ConfigController).set('multiple', true);

    const second = ensureUploaderCtx(ctxName);

    expect(second).toBe(first);
    expect(second.get(ConfigController).get('multiple')).toBe(true);
  });

  it('gives each ctx its own container', () => {
    const ctxNameA = freshCtxName();
    const ctxNameB = freshCtxName();
    const containerA = ensureUploaderCtx(ctxNameA);
    const containerB = ensureUploaderCtx(ctxNameB);

    expect(containerA).not.toBe(containerB);
    expect(containerA.get(RouterController)).not.toBe(containerB.get(RouterController));
  });
});
