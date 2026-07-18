import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { ConfigController } from '@/abstract/controllers/ConfigController';
import '../types/jsx';
import { cleanup, getCtxName } from './utils/test-renderer';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
});

describe('Config', () => {
  describe('cdnCname', () => {
    it('should be ucarecdn.com by default', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      expect(config.cdnCname).toBe('https://ucarecdn.com');
    });

    it('should be updated synchronously', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.cdnCname = 'https://cdn.example.com';
      expect(config.cdnCname).toBe('https://cdn.example.com');
    });

    it('should be async calculated from pubkey if another custom domain is not set', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.pubkey = 'demopublickey';
      expect(config.cdnCname).toBe('https://ucarecdn.com');
      await expect.poll(() => config.cdnCname).toBe('https://1s4oyld5dc.ucarecd.net');
    });

    it('should not be calculated if another custom domain is set', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.cdnCname = 'https://cdn.example.com';
      config.pubkey = 'demopublickey';
      await expect.poll(() => config.cdnCname).toBe('https://cdn.example.com');
    });

    it('should be calculated if pubkey is changed and custom domain is not present', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.pubkey = 'demopublickey';
      await expect.poll(() => config.cdnCname).toBe('https://1s4oyld5dc.ucarecd.net');
      config.pubkey = 'anotherpublickey';
      await expect.poll(() => config.cdnCname).toBe('https://t8zl5ek5q1.ucarecd.net');
    });

    it('should be initially loaded from attribute without pubkey defined', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
          <uc-config ctx-name={ctxName} cdn-cname="https://cdn.example.com" testMode></uc-config>
          <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
        </>,
      );
      const config = page.getByTestId('uc-config').query()! as Config;
      expect(config.cdnCname).toBe('https://cdn.example.com');
    });
  });

  /**
   * Coverage gap-fill for the M9p ChildBlock port: exercising `<uc-config>`
   * (now a `ChildBlock`) in four scenarios neither `config.e2e.test.tsx` nor
   * `plugins/custom-config.e2e.test.tsx` net covers, but the port could
   * plausibly change:
   *  - a standalone `<uc-config>` with no solution/provider ever present
   *    (self-bootstrap + M9o refcount teardown on its own);
   *  - `ctx-name` reassignment on an already-initialized, live element;
   *  - a custom-config attribute mutated DURING a live `ctx-name` switch —
   *    the exact case the pre-ctx guard (`PubSub.getCtx(effectiveCtxName)`)
   *    covers and `uploaderOrNull` did not;
   *  - an attribute set on a freshly-created (unconnected) element, before any
   *    ctx/controller exists at all.
   * These are additive only — no existing test is modified.
   */
  describe('standalone lifecycle (no solution/provider)', () => {
    it('self-bootstraps its own ctx, exposes readable config defaults, and tears the ctx down once removed (M9o refcount)', async () => {
      cleanup();
      const ctxName = getCtxName();
      const { PubSub } = await import('@/lit/PubSubCompat.js');
      expect(PubSub.hasCtx(ctxName)).toBe(false);

      // No uc-file-uploader-*, no uc-upload-ctx-provider: `<uc-config>` is the
      // only block in the composition.
      page.render(<uc-config ctx-name={ctxName} testMode></uc-config>);
      const config = page.getByTestId('uc-config').query()! as Config;

      // The ctx now exists purely because this one ChildBlock self-bootstrapped
      // it (`_watchRegistry` → `ensureUploaderCtx`), with no v1 block present.
      expect(PubSub.hasCtx(ctxName)).toBe(true);
      // Plain ConfigController default, readable with no other block present.
      expect(config.cdnCname).toBe('https://ucarecdn.com');

      // Removing the sole consumer must tear the self-bootstrapped ctx down,
      // driven by `ChildBlock.disconnectedCallback`'s deferred M9o refcount
      // check (`isCtxUnreferenced` → `!UploaderRegistry.hasConsumers`).
      cleanup();
      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(false);
    });
  });

  describe('ctx-name reassignment on a live element', () => {
    it('M9p port behavior: reassigning ctx-name on an already-initialized element rebinds to the new ctx (ChildBlock re-adopts) and refcount-tears-down the abandoned ctx', async () => {
      cleanup();
      const ctxNameA = getCtxName();
      const ctxNameB = getCtxName();
      const { PubSub } = await import('@/lit/PubSubCompat.js');

      page.render(<uc-config ctx-name={ctxNameA} pubkey="demopublickey" testMode></uc-config>);
      const config = page.getByTestId('uc-config').query()! as Config;
      expect(config.pubkey).toBe('demopublickey');
      expect(PubSub.hasCtx(ctxNameA)).toBe(true);
      expect(PubSub.hasCtx(ctxNameB)).toBe(false);

      config.setAttribute('ctx-name', ctxNameB);
      await config.updateComplete;

      // The DOM attribute switched...
      expect(config.getAttribute('ctx-name')).toBe(ctxNameB);
      // ...and — INTENDED CHANGE at the M9p port — `ChildBlock` re-adopts on
      // ctx-name switch (M9o): the ported `<uc-config>` rebinds to ctxNameB
      // (the new ctx now exists, seeded with the value carried over from the
      // element's local property cache) and, once nothing else references it,
      // the abandoned ctxNameA is refcount-torn-down (M9o). This inverts the
      // v1 quirk above — `SymbioteCompatMixin` never re-initialized and the
      // binding stayed on the original ctx forever.
      expect(config.pubkey).toBe('demopublickey');
      await expect.poll(() => PubSub.hasCtx(ctxNameB)).toBe(true);
      await expect.poll(() => PubSub.hasCtx(ctxNameA)).toBe(false);

      // The value did move to the new ctx's `ConfigController` — not just the
      // element's local cache — confirming reads/writes now go through ctxB.
      const configApi = PubSub.getCtx(ctxNameB)!.container().get(ConfigController);
      expect(configApi.get('pubkey')).toBe('demopublickey');
    });
  });

  describe('custom-config attribute mutated mid ctx-name switch', () => {
    it('does not throw when a custom-config attr fires while pointing at a not-yet-created ctx — the PubSub.getCtx guard uploaderOrNull did not cover', async () => {
      cleanup();
      const ctxNameA = getCtxName();
      const ctxNameB = getCtxName();
      const { PubSub } = await import('@/lit/PubSubCompat.js');

      page.render(<uc-config ctx-name={ctxNameA} testMode></uc-config>);
      const config = page.getByTestId('uc-config').query()! as Config;
      await config.updateComplete;
      expect(PubSub.hasCtx(ctxNameA)).toBe(true);

      // Point the element at a brand-new ctx name. `super.attributeChangedCallback`
      // updates `effectiveCtxName` to B synchronously, but `ChildBlock`'s adoption
      // (`_watchRegistry` → `ensureUploaderCtx`) runs in a later microtask, so B's
      // ctx does NOT exist yet — this is the guard's window.
      config.setAttribute('ctx-name', ctxNameB);
      expect(PubSub.hasCtx(ctxNameB)).toBe(false);

      // In that window a custom-config attribute mutation reaches
      // `attributeChangedCallback`'s else-branch — exactly how the
      // `_bindObservedCustomAttributes` MutationObserver forwards custom attrs
      // (`this.attributeChangedCallback(attrName, …)`, `Config.ts`). The element
      // is still adopted to controller A while `this.bag` now targets nonexistent
      // ctx B: the case the rejected `uploaderOrNull` guard did NOT cover (it
      // stayed truthy = A and let `bag.when` → `_requireCtx(B)` throw "shared
      // context is not initialized yet", aborting init — the M9p regression that
      // spawned M9q). The shipped `PubSub.getCtx(effectiveCtxName)` guard returns
      // early instead of touching the bag.
      expect(() => config.attributeChangedCallback('a-custom-plugin-config', '', 'mid-switch')).not.toThrow();

      // ...and the switch still resolves cleanly afterwards.
      await config.updateComplete;
      await expect.poll(() => PubSub.hasCtx(ctxNameB)).toBe(true);
    });
  });

  describe('pre-adoption attribute set (no controller yet)', () => {
    it('an attribute set on a freshly-created, unconnected uc-config (before any ctx/controller exists) is applied once the element connects and initializes', async () => {
      cleanup();
      const ctxName = getCtxName();
      // `document.createElement('uc-config')` resolves to the src `Config`
      // class, while the ambient `Config` (from `../types/jsx`) is the built
      // `dist` declaration; a direct cast trips TS2352 on their separate
      // private `_debugPrint`. Bridge through `unknown` (test-only boundary).
      const el = document.createElement('uc-config') as unknown as Config;

      // Set the attribute before the element is ever connected: no ctx, no
      // PubSub map, no controller exists for `ctxName` at this point.
      el.setAttribute('pubkey', 'pre-connect-key');
      // No setter/getter has been installed yet (that happens in
      // `controllerReady`, which only runs once connected + adopted) — the
      // value must still be readable as a plain instance property.
      expect(el.pubkey).toBe('pre-connect-key');

      el.setAttribute('ctx-name', ctxName);
      document.body.appendChild(el);
      try {
        await el.updateComplete;
        // The pre-connection attribute value must have been picked up by
        // `controllerReady`'s `anyThis[key] ?? this.uploader.config.get(key)`
        // read and applied to the now-initialized shared config state.
        expect(el.pubkey).toBe('pre-connect-key');
      } finally {
        el.remove();
      }
    });
  });
});
