import { beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { TelemetryManager } from '@/abstract/managers/TelemetryManager';
import type { Config, UploadCtxProvider } from '@/index.js';
import { PubSub } from '@/lit/PubSubCompat';
import type { SharedState } from '@/lit/SharedState';
import { controllerOwnedInstanceKeys } from '@/lit/shared-instances';
import { getCtxName } from '../utils/getCtxName';
import { cleanup } from '../utils/test-renderer';
import '../../types/jsx';

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
 */
describe('instance lifecycle (config-only ctx)', () => {
  it('a config-only ctx (no uploader block) still builds every LitBlock-scope instance, and tears down cleanly', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" qualityInsights={false} testMode></uc-config>);

    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);
    const ctx = PubSub.getCtx<SharedState>(ctxName)!;

    // Every instance `LitBlock.initCallback` adds unconditionally, even with
    // no uploader block in the tree.
    expect(ctx.has('*blocksRegistry')).toBe(true);
    expect(ctx.has('*pluginManager')).toBe(true);
    expect(ctx.has('*eventEmitter')).toBe(true);
    expect(ctx.has('*localeManager')).toBe(true);
    expect(ctx.has('*a11y')).toBe(true);
    expect(ctx.has('*router')).toBe(true);
    expect(ctx.has('*clipboard')).toBe(true);
    expect(ctx.has('*telemetryManager')).toBe(true);

    // `*uploadCollection` is added by `LitUploaderBlock`, not `LitBlock` —
    // `<uc-config>` alone must not create it.
    expect(ctx.has('*uploadCollection')).toBe(false);

    const errors: string[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(String(event.error?.message ?? event.message));
      event.preventDefault();
    };
    window.addEventListener('error', onError);
    try {
      cleanup();
      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(false);
    } finally {
      window.removeEventListener('error', onError);
    }
    expect(errors).toEqual([]);
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
    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);

    try {
      // Keep a live reference to a v1 LitBlock past the DOM teardown — same
      // shape as a queued callback holding a reference to an unmounted block.
      const config = page.getByTestId('uc-config').query()! as Config;

      cleanup();
      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(false);

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
    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);
    const firstCtx = PubSub.getCtx<SharedState>(ctxName)!;
    const firstRouter = firstCtx.read('*router');
    const firstTelemetry = firstCtx.read('*telemetryManager');

    // Prove the first router carries real navigation state before teardown.
    await page.getByText('Upload files', { exact: true }).click();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();
    expect(firstRouter.currentActivity).not.toBeNull();

    cleanup();
    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(false);

    // Same ctx-name, brand-new elements.
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);
    const secondCtx = PubSub.getCtx<SharedState>(ctxName)!;
    const secondRouter = secondCtx.read('*router');
    const secondTelemetry = secondCtx.read('*telemetryManager');

    expect(secondRouter).not.toBe(firstRouter);
    expect(secondTelemetry).not.toBe(firstTelemetry);
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
    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);
    const ctx = PubSub.getCtx<SharedState>(ctxName)!;

    // The five controller-owned shared instances (M9k): teardown runs through
    // two paths — `LitBlock._destroySharedContextInstances` (the DOM-layer
    // pub-null loop) and `UploaderController.destroy()` (via
    // `PubSub.deleteCtx`) — and only the latter may actually call `.destroy()`
    // on these, or they'd be torn down twice.
    const eventEmitter = ctx.read('*eventEmitter');
    const localeManager = ctx.read('*localeManager');
    const telemetryManager = ctx.read('*telemetryManager');
    const router = ctx.read('*router');
    const uploadCollection = ctx.read('*uploadCollection');

    const eventEmitterDestroy = vi.spyOn(eventEmitter, 'destroy');
    const localeManagerDestroy = vi.spyOn(localeManager, 'destroy');
    const telemetryManagerDestroy = vi.spyOn(telemetryManager, 'destroy');
    const routerDestroy = vi.spyOn(router, 'destroy');
    const uploadCollectionDestroy = vi.spyOn(uploadCollection, 'destroy');

    cleanup();
    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(false);

    expect(eventEmitterDestroy).toHaveBeenCalledTimes(1);
    expect(localeManagerDestroy).toHaveBeenCalledTimes(1);
    expect(telemetryManagerDestroy).toHaveBeenCalledTimes(1);
    expect(routerDestroy).toHaveBeenCalledTimes(1);
    expect(uploadCollectionDestroy).toHaveBeenCalledTimes(1);
  });
});

describe('instance lifecycle (controller-owned identity pins, M9l final-review follow-up)', () => {
  it('every controller-owned shared-instance key resolves to the exact instance UploaderController owns (no re-shadowing)', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);
    const ctx = PubSub.getCtx<SharedState>(ctxName)!;
    const controller = ctx.uploaderController();

    // Explicit key -> controller-member map: self-documenting, and the two
    // assertions below make it exhaustive against `controllerOwnedInstanceKeys`
    // itself (imported, not hand-copied) — a key added to the Set without a
    // matching entry here fails loudly instead of silently passing every
    // other test while an element-side `new X()` re-shadows the real,
    // controller-owned instance (and leaks its listeners at teardown).
    const ownerByKey: Record<string, () => unknown> = {
      '*eventEmitter': () => controller.eventEmitter,
      '*localeManager': () => controller.localeManager,
      '*telemetryManager': () => controller.telemetryManager,
      '*router': () => controller.router,
      '*uploadCollection': () => controller.collection,
      '*a11y': () => controller.a11y,
      '*clipboard': () => controller.clipboard,
    } satisfies Record<string, () => unknown>;

    // Fence: `controllerOwnedInstanceKeys` must not outgrow this map.
    expect(new Set(Object.keys(ownerByKey))).toEqual(new Set(controllerOwnedInstanceKeys));

    for (const key of controllerOwnedInstanceKeys) {
      const getOwnerInstance = ownerByKey[key];
      expect(getOwnerInstance, `no identity-pin mapping registered for key "${String(key)}"`).toBeDefined();
      expect(ctx.read(key)).toBe(getOwnerInstance!());
    }
  });
});
