import { beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { ClipboardController } from '@/abstract/controllers/ClipboardController';
import { LocaleController } from '@/abstract/controllers/LocaleController';
import { RouterController } from '@/abstract/controllers/RouterController';
import { SecureUploadsController } from '@/abstract/controllers/SecureUploadsController';
import { UploadCollectionController } from '@/abstract/controllers/UploadCollectionController';
import { UploadController } from '@/abstract/controllers/UploadController';
import { UploadEventsController } from '@/abstract/controllers/UploadEventsController';
import { ValidationController } from '@/abstract/controllers/ValidationController';
import type { ControllerContainer, Token } from '@/abstract/di/ControllerContainer';
import { A11y } from '@/abstract/managers/a11y';
import { LocaleManager } from '@/abstract/managers/LocaleManager';
import { PluginController } from '@/abstract/managers/plugin';
import { TelemetryManager } from '@/abstract/managers/TelemetryManager';
import { EventEmitter } from '@/blocks/UploadCtxProvider/EventEmitter';
import type { Config, UploadCtxProvider } from '@/index.js';
import { delay } from '@/utils/delay';
import { getCtxName } from '../utils/getCtxName';
import { containerOf, hasCtx } from '../utils/registry';
import { cleanup } from '../utils/test-renderer';
import '../../types/jsx';

// M-god step 8e dissolved the `UploaderController` facade; the registry/ctx now
// resolve the ctx's `ControllerContainer`. This view reproduces the facade's
// read surface off the container, so the existing `controller.X` assertions
// below stay identical (each `.X` resolves the same container-owned instance).
const ctrlView = (container: ControllerContainer) => ({
  get eventEmitter() {
    return container.get(EventEmitter);
  },
  get localeManager() {
    return container.get(LocaleManager);
  },
  get a11y() {
    return container.get(A11y);
  },
  get router() {
    return container.get(RouterController);
  },
  get clipboard() {
    return container.get(ClipboardController);
  },
  get telemetryManager() {
    return container.get(TelemetryManager);
  },
  get collection() {
    return container.get(UploadCollectionController);
  },
  container,
});

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

/**
 * Gap-fill ahead of M9k Task 2 (moving construction of RouterController,
 * PluginController, TelemetryManager, LocaleManager, EventEmitter off
 * `LitBlock.initCallback` onto `UploaderController`). Pins instance-lifecycle
 * behavior nothing else currently exercises, so the construction move has a
 * regression net.
 *
 * UPDATED at the M9p `<uc-config>` port: `<uc-config>` stopped being a v1
 * `LitBlock` (it's now a `ChildBlock`), so it no longer runs
 * `LitBlock.initCallback`'s unconditional bootstrap of `*blocksRegistry`,
 * `*pluginManager`, and the re-exposed `*eventEmitter`/`*localeManager`/
 * `*a11y`/`*router`/`*clipboard`/`*telemetryManager` legacy ctx keys — that
 * bootstrap is tied to an actual v1 `LitBlock` instance existing somewhere in
 * the composition (e.g. a solution block), which a config-only composition no
 * longer has. `ensureUploaderCtx` still forces the `UploaderController` (and
 * therefore `ConfigController`, `EventBus`, `LocaleController`,
 * `RouterController`, `A11y`, `ClipboardController`, `TelemetryManager`) into
 * existence the moment the ctx exists — those six are readable directly off
 * the controller, just not re-exposed under their legacy `*`-prefixed ctx
 * keys without a v1 block to do the re-exposing. `*pluginManager` has no
 * controller equivalent at all (it stays DOM/`LitBlock`-constructed by
 * design — see `PluginController`'s and `LitBlock.initCallback`'s own
 * comments) so a config-only ctx genuinely has no plugin manager; custom
 * (plugin-registered) configs are unavailable in that composition, same as
 * before this port for any other ChildBlock-only scope.
 */
describe('instance lifecycle (config-only ctx)', () => {
  it('a config-only ctx (no v1 LitBlock) still builds the controller and its owned instances, and tears down cleanly', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" qualityInsights={false} testMode></uc-config>);

    await expect.poll(() => hasCtx(ctxName)).toBe(true);
    const container = containerOf(ctxName);
    const controller = ctrlView(container);

    // The six always-constructed managers exist — `ensureUploaderCtx` eagerly
    // resolves them off the container the moment the ctx exists, with no v1
    // block required.
    expect(controller.eventEmitter).toBeTruthy();
    expect(controller.localeManager).toBeTruthy();
    expect(controller.a11y).toBeTruthy();
    expect(controller.router).toBeTruthy();
    expect(controller.clipboard).toBeTruthy();
    expect(controller.telemetryManager).toBeTruthy();

    // The six eagerly-constructed managers are present on the container the
    // moment the ctx-creation seam (`ensureUploaderCtx`) ran — no v1 `LitBlock`
    // required. (These were the `*`-keyed re-exposers before M-god step 9c-2;
    // the container is now the sole home.)
    expect(container.has(EventEmitter)).toBe(true);
    expect(container.has(LocaleManager)).toBe(true);
    expect(container.has(A11y)).toBe(true);
    expect(container.has(RouterController)).toBe(true);
    expect(container.has(ClipboardController)).toBe(true);
    expect(container.has(TelemetryManager)).toBe(true);

    // `PluginController` is v1-element-gated (needs plugins) — a config-only ctx
    // never constructs it.
    expect(container.has(PluginController)).toBe(false);

    // `UploadCollectionController` is added by the uploader element layer, not
    // the config-only seam — `<uc-config>` alone must not create it.
    expect(container.has(UploadCollectionController)).toBe(false);

    // The four upload-stack controllers are only resolved by the element-layer
    // `ensureUploaderScope`/`registerUploadStack` (M-god step 5) — a bare
    // `<uc-config>` never runs that path, so none of them exist either.
    expect(container.has(SecureUploadsController)).toBe(false);
    expect(container.has(UploadController)).toBe(false);
    expect(container.has(ValidationController)).toBe(false);
    expect(container.has(UploadEventsController)).toBe(false);

    const errors: string[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(String(event.error?.message ?? event.message));
      event.preventDefault();
    };
    window.addEventListener('error', onError);
    try {
      cleanup();
      await expect.poll(() => hasCtx(ctxName)).toBe(false);
    } finally {
      window.removeEventListener('error', onError);
    }
    expect(errors).toEqual([]);
  });
});

/**
 * Gap-fill ahead of M9o Tasks 2-3 (self-bootstrap ctx creation + unified
 * consumer-refcount teardown). Pins the current `setTimeout(0)` deferral
 * guard in `LitBlock.disconnectedCallback` (:263-271) — a DOM-move-in-the-
 * same-tick must not destroy the ctx — so the upcoming refcount-based
 * teardown condition has a regression net for this seam.
 */
describe('instance lifecycle (v1 teardown deferral guard)', () => {
  it('a block disconnecting then reconnecting within the same tick does not tear down the ctx', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    await expect.poll(() => hasCtx(ctxName)).toBe(true);
    const firstContainer = containerOf(ctxName);

    const el = page.getByTestId('uc-config').query()!;
    const parent = el.parentElement!;

    // Moving the element within the DOM (remove + re-append) runs
    // disconnectedCallback then connectedCallback synchronously, before the
    // deferred `setTimeout(0)` destroy check (scheduled by the disconnect)
    // fires — its re-check of `this.isConnected` must see it reconnected and
    // bail out without destroying the ctx.
    el.remove();
    parent.append(el);

    // Let that deferred setTimeout(0) task actually run before asserting
    // nothing was torn down.
    await delay(0);

    expect(hasCtx(ctxName)).toBe(true);
    // Same ctx/container instance — not destroyed and recreated.
    expect(containerOf(ctxName)).toBe(firstContainer);
  });
});

describe('instance lifecycle (emit contract, router-driven path)', () => {
  it('a router-driven navigation dispatches the documented event on the provider AND mirrors it to telemetry', async () => {
    const sendEventSpy = vi.spyOn(TelemetryManager.prototype, 'sendEvent');
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    try {
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const openHandler = vi.fn<(e: CustomEvent<unknown>) => void>();
      ctxProvider.addEventListener('modal-open', openHandler);

      sendEventSpy.mockClear(); // drop init-solution/config noise from setup

      // The router's own navigation — not a block calling `emit` directly —
      // drives this: `RouterController` → `UploaderController.emit`.
      await page.getByText('Upload files', { exact: true }).click();
      await expect.element(page.getByTestId('uc-start-from')).toBeVisible();

      await expect.poll(() => openHandler.mock.calls.length).toBe(1);
      expect((openHandler.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ modalId: 'start-from' });

      // Telemetry mirror: the same router-driven emit reaches `sendEvent` with
      // the matching documented event type (debounced, but the queued call
      // still lands within the poll window).
      await expect.poll(() => sendEventSpy.mock.calls.some((call) => call[0]?.eventType === 'modal-open')).toBe(true);
    } finally {
      sendEventSpy.mockRestore();
    }
  });

  it('emitting on a LitBlock instance after its ctx has been torn down is a silent no-op (no telemetry, no throw)', async () => {
    const sendEventSpy = vi.spyOn(TelemetryManager.prototype, 'sendEvent');
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    await expect.poll(() => hasCtx(ctxName)).toBe(true);

    try {
      // Keep a live reference to a v1 LitBlock past the DOM teardown — same
      // shape as a queued callback holding a reference to an unmounted block.
      const config = page.getByTestId('uc-config').query()! as Config;

      cleanup();
      await expect.poll(() => hasCtx(ctxName)).toBe(false);

      sendEventSpy.mockClear();
      const errors: string[] = [];
      const onError = (event: ErrorEvent) => {
        errors.push(String(event.error?.message ?? event.message));
        event.preventDefault();
      };
      window.addEventListener('error', onError);
      try {
        expect(() => config.emit('modal-close', { modalId: 'start-from', hasActiveModals: false })).not.toThrow();
      } finally {
        window.removeEventListener('error', onError);
      }
      expect(errors).toEqual([]);
      expect(sendEventSpy).not.toHaveBeenCalled();
    } finally {
      sendEventSpy.mockRestore();
    }
  });
});

describe('instance lifecycle (destroy -> recreate cycle)', () => {
  it('reusing the same ctx-name after a full teardown rebuilds fresh instances, not the destroyed ones', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    await expect.poll(() => hasCtx(ctxName)).toBe(true);
    const firstContainer = containerOf(ctxName);
    const firstRouter = firstContainer.get(RouterController);
    const firstTelemetry = firstContainer.get(TelemetryManager);
    const firstUploadController = firstContainer.get(UploadController);

    // Prove the first router carries real navigation state before teardown.
    await page.getByText('Upload files', { exact: true }).click();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();
    expect(firstRouter.currentActivity).not.toBeNull();

    cleanup();
    await expect.poll(() => hasCtx(ctxName)).toBe(false);

    // Same ctx-name, brand-new elements.
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    await expect.poll(() => hasCtx(ctxName)).toBe(true);
    const secondContainer = containerOf(ctxName);
    const secondRouter = secondContainer.get(RouterController);
    const secondTelemetry = secondContainer.get(TelemetryManager);
    const secondUploadController = secondContainer.get(UploadController);

    expect(secondRouter).not.toBe(firstRouter);
    expect(secondTelemetry).not.toBe(firstTelemetry);
    // The upload-stack (M9m `attachUploaderScope`) is rebuilt fresh too — not
    // resurrected from the destroyed scope.
    expect(secondUploadController).not.toBe(firstUploadController);
    // Fresh router state — no leaked navigation from the destroyed ctx.
    expect(secondRouter.currentActivity).toBeNull();
  });
});

describe('instance lifecycle (single-owner teardown, M9k Task 3)', () => {
  it('a full ctx teardown destroys each controller-owned manager exactly once', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    await expect.poll(() => hasCtx(ctxName)).toBe(true);
    const container = containerOf(ctxName);

    // The container-owned managers: teardown must call `.destroy()` on each
    // exactly once. `UploaderRegistry.dispose` disposes the container, which
    // destroys each cached controller a single time — nothing else may.
    const eventEmitter = container.get(EventEmitter);
    const localeManager = container.get(LocaleManager);
    const telemetryManager = container.get(TelemetryManager);
    const router = container.get(RouterController);
    const uploadCollection = container.get(UploadCollectionController);
    // The four upload-stack instances (M9m `attachUploaderScope`): same
    // single-owner concern — resolved off the same container.
    const secureUploadsManager = container.get(SecureUploadsController);
    const uploadController = container.get(UploadController);
    const validationManager = container.get(ValidationController);
    const uploadEvents = container.get(UploadEventsController);

    const eventEmitterDestroy = vi.spyOn(eventEmitter, 'destroy');
    const localeManagerDestroy = vi.spyOn(localeManager, 'destroy');
    const telemetryManagerDestroy = vi.spyOn(telemetryManager, 'destroy');
    const routerDestroy = vi.spyOn(router, 'destroy');
    const uploadCollectionDestroy = vi.spyOn(uploadCollection, 'destroy');
    const secureUploadsManagerDestroy = vi.spyOn(secureUploadsManager, 'destroy');
    const uploadControllerDestroy = vi.spyOn(uploadController, 'destroy');
    const validationManagerDestroy = vi.spyOn(validationManager, 'destroy');
    const uploadEventsDestroy = vi.spyOn(uploadEvents, 'destroy');

    cleanup();
    await expect.poll(() => hasCtx(ctxName)).toBe(false);

    expect(eventEmitterDestroy).toHaveBeenCalledTimes(1);
    expect(localeManagerDestroy).toHaveBeenCalledTimes(1);
    expect(telemetryManagerDestroy).toHaveBeenCalledTimes(1);
    expect(routerDestroy).toHaveBeenCalledTimes(1);
    expect(uploadCollectionDestroy).toHaveBeenCalledTimes(1);
    expect(secureUploadsManagerDestroy).toHaveBeenCalledTimes(1);
    expect(uploadControllerDestroy).toHaveBeenCalledTimes(1);
    expect(validationManagerDestroy).toHaveBeenCalledTimes(1);
    expect(uploadEventsDestroy).toHaveBeenCalledTimes(1);
  });
});

describe('instance lifecycle (attachUploaderScope idempotency across two LitUploaderBlock instances, M9m Task 3)', () => {
  it('a second LitUploaderBlock joining the same ctx does not double-construct the upload stack', async () => {
    const ctxName = getCtxName();
    const observeSpy = vi.spyOn(UploadEventsController.prototype, 'observe');

    try {
      // First LitUploaderBlock instance: its `initCallback` calls
      // `attachUploaderScope`, constructing the four sub-controllers and
      // starting `UploadEventsController.observe()` once.
      page.render(
        <>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
          <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        </>,
      );
      await expect.poll(() => hasCtx(ctxName)).toBe(true);
      const container = containerOf(ctxName);
      await expect.poll(() => container.has(UploadController)).toBe(true);

      const firstUploadController = container.get(UploadController);
      const firstUploadEvents = container.get(UploadEventsController);
      expect(observeSpy).toHaveBeenCalledTimes(1);

      // Second LitUploaderBlock instance joins the SAME ctx-name —
      // `uc-upload-ctx-provider` also extends `LitUploaderBlock`, so its
      // `initCallback` runs `attachUploaderScope` again against the same
      // `UploaderController`. The idempotency guard (`this._uploaderScope`)
      // must make this a no-op: same instances, no second `observe()`.
      page.render(<uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>);
      await expect.poll(() => page.getByTestId('uc-upload-ctx-provider').query()).not.toBeNull();

      expect(container.get(UploadController)).toBe(firstUploadController);
      expect(container.get(UploadEventsController)).toBe(firstUploadEvents);
      expect(observeSpy).toHaveBeenCalledTimes(1);
    } finally {
      observeSpy.mockRestore();
    }
  });
});

/**
 * M9q pins (RED ahead of the seam fix). M9k/M9l moved six managers'
 * *construction* onto `UploaderController`, but their ctx-scope KEY
 * registration (`_addSharedContextInstance('*router', …)` etc.) plus
 * `LocaleManager.activate` still live on `LitBlock.initCallback` only.
 * `ensureUploaderCtx` (the `ChildBlock` self-bootstrap path, M9o) forces the
 * controller into existence but registers NO instance keys — so a
 * ChildBlock-only composition (no v1 block anywhere) has a controller with
 * all six managers constructed, yet `bag.router`/`ctx.read('*router')`/etc.
 * still throw "shared instance … not available", and the locale dictionary
 * is never seeded (`LocaleManager.activate` never runs). These pins fail
 * RED today and must go green once M9q registers the keys (+ runs
 * `activate`) from the ctx-scope seam itself, not `LitBlock`.
 */
describe('instance lifecycle (M9q ChildBlock-only ctx-scope keys)', () => {
  it('a ChildBlock-only ctx (no v1 block anywhere) resolves all six controller-owned ctx-scope keys after adoption', async () => {
    const ctxName = getCtxName();
    // `uc-copyright` is a pure-consumer ported `ChildBlock` — no `uc-config`,
    // no solution tag, no `uc-drop-area`: nothing v1 in this composition.
    page.render(<uc-copyright ctx-name={ctxName}></uc-copyright>);

    await expect.element(page.getByText('Powered by Uploadcare', { exact: true })).toBeVisible();
    await expect.poll(() => hasCtx(ctxName)).toBe(true);

    const container = containerOf(ctxName);
    const controller = ctrlView(container);

    // A v1-free composition still eagerly constructs the six ctx-scoped
    // managers off the container — `ensureUploaderCtx` runs on the ChildBlock
    // self-bootstrap path, no `LitBlock.initCallback` required.
    expect(container.has(RouterController)).toBe(true);
    expect(container.has(EventEmitter)).toBe(true);
    expect(container.has(LocaleManager)).toBe(true);
    expect(container.has(A11y)).toBe(true);
    expect(container.has(ClipboardController)).toBe(true);
    expect(container.has(TelemetryManager)).toBe(true);

    // Identity, not just presence: the container resolves the exact instance
    // the `ctrlView` getters own — a single cached instance per token, no
    // re-shadowed duplicate.
    expect(container.get(RouterController)).toBe(controller.router);
    expect(container.get(EventEmitter)).toBe(controller.eventEmitter);
    expect(container.get(LocaleManager)).toBe(controller.localeManager);
    expect(container.get(A11y)).toBe(controller.a11y);
    expect(container.get(ClipboardController)).toBe(controller.clipboard);
    expect(container.get(TelemetryManager)).toBe(controller.telemetryManager);

    // `l10n` resolves a real dictionary entry — proves `LocaleManager.
    // activate` actually ran (seeded the `en` dictionary) on the ChildBlock
    // self-bootstrap path, not just that the manager instance exists.
    expect(container.get(LocaleController).get('upload-file')).toBe('Upload file');
  });

  it('the same ChildBlock-only ctx tears down cleanly once the block disconnects (M9o refcount, no double-destroy)', async () => {
    const ctxName = getCtxName();
    page.render(<uc-copyright ctx-name={ctxName}></uc-copyright>);
    await expect.poll(() => hasCtx(ctxName)).toBe(true);

    const errors: string[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(String(event.error?.message ?? event.message));
      event.preventDefault();
    };
    window.addEventListener('error', onError);
    try {
      cleanup();
      // The deferred (`setTimeout(0)`) consumer-refcount check needs a real
      // macrotask flush before `isCtxUnreferenced` re-evaluates.
      await expect.poll(() => hasCtx(ctxName)).toBe(false);
    } finally {
      window.removeEventListener('error', onError);
    }
    expect(errors).toEqual([]);
  });

  it('inert under v1: a normal composition is unchanged — one `*router` instance, identical to the controller’s', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    await expect.poll(() => hasCtx(ctxName)).toBe(true);
    const container = containerOf(ctxName);
    const controller = ctrlView(container);

    expect(container.get(RouterController)).toBe(controller.router);
    expect(container.get(LocaleController).get('upload-file')).toBe('Upload file');

    cleanup();
    await expect.poll(() => hasCtx(ctxName)).toBe(false);
  });
});

describe('instance lifecycle (container-owned single-instance pins, M9l final-review follow-up)', () => {
  it('every ctx-scoped controller resolves to a single cached instance off the container (no re-shadowing)', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    await expect.poll(() => hasCtx(ctxName)).toBe(true);
    const container = containerOf(ctxName);

    // The full roster of ctx-scoped controllers a live uploader composition
    // constructs. After M-god step 9c-2 the container is the SOLE home for
    // these — there is no parallel `*`-keyed re-exposer to keep in sync, so
    // "no re-shadowing" reduces to: each token resolves, and resolves to the
    // same cached instance every time.
    const tokens: Token<unknown>[] = [
      EventEmitter,
      LocaleManager,
      TelemetryManager,
      RouterController,
      UploadCollectionController,
      A11y,
      ClipboardController,
      PluginController,
      SecureUploadsController,
      UploadController,
      ValidationController,
      UploadEventsController,
    ];

    for (const token of tokens) {
      expect(container.has(token), `container did not construct ${token.name}`).toBe(true);
      // Stable identity: the DI container caches one instance per token.
      expect(container.get(token)).toBe(container.get(token));
    }
  });
});
