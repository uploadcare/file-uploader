import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
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
   * Coverage gap-fill for the M9p ChildBlock port: pinning CURRENT `<uc-config>`
   * (v1 `LitBlock`) behavior in three scenarios the neither `config.e2e.test.tsx`
   * nor `plugins/custom-config.e2e.test.tsx` net covers, but the port could
   * plausibly change:
   *  - a standalone `<uc-config>` with no solution/provider ever present
   *    (self-bootstrap + M9o refcount teardown on its own);
   *  - `ctx-name` reassignment on an already-initialized, live element;
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

      // The ctx now exists purely because this one v1 block bootstrapped it.
      expect(PubSub.hasCtx(ctxName)).toBe(true);
      // Plain ConfigController default, readable with no other block present.
      expect(config.cdnCname).toBe('https://ucarecdn.com');

      // Removing the sole consumer must tear the self-bootstrapped ctx down
      // (mirrors the ChildBlock-only M9o teardown path, driven here by
      // `LitBlock.disconnectedCallback`'s `*blocksRegistry`-empty check).
      cleanup();
      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(false);
    });
  });

  describe('ctx-name reassignment on a live element', () => {
    it('current v1 behavior: reassigning ctx-name on an already-initialized element updates the attribute/state but stays bound to the original ctx (SymbioteCompatMixin never re-initializes)', async () => {
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
      // ...but `_symbioteFirstUpdated` gates `_performInitialization` to a
      // single call per element lifetime: the shared PubSub binding never
      // moves. Values keep reading/writing through the original ctx, and no
      // second ctx is ever created for this reassignment.
      //
      // INTENDED CHANGE at the M9p port: `ChildBlock` re-adopts on ctx-name
      // switch (M9o), so the ported `<uc-config>` WILL rebind to ctxNameB and
      // (refcount-)tear down ctxNameA. The Task-2 port must UPDATE this test to
      // the re-adopt behavior — not preserve the v1 quirk below (mirrors the
      // M9o "gates forever" child-block pin that was likewise inverted).
      expect(config.pubkey).toBe('demopublickey');
      expect(PubSub.hasCtx(ctxNameA)).toBe(true);
      expect(PubSub.hasCtx(ctxNameB)).toBe(false);
    });
  });

  describe('pre-adoption attribute set (no controller yet)', () => {
    it('an attribute set on a freshly-created, unconnected uc-config (before any ctx/controller exists) is applied once the element connects and initializes', async () => {
      cleanup();
      const ctxName = getCtxName();
      const el = document.createElement('uc-config') as Config;

      // Set the attribute before the element is ever connected: no ctx, no
      // PubSub map, no controller exists for `ctxName` at this point.
      el.setAttribute('pubkey', 'pre-connect-key');
      // No setter/getter has been installed yet (that happens in
      // `initCallback`, which only runs once connected) — the value must
      // still be readable as a plain instance property.
      expect(el.pubkey).toBe('pre-connect-key');

      el.setAttribute('ctx-name', ctxName);
      document.body.appendChild(el);
      try {
        await el.updateComplete;
        // The pre-connection attribute value must have been picked up by
        // `initCallback`'s `anyThis[key] ?? this.$[...]` read and applied to
        // the now-initialized shared config state.
        expect(el.pubkey).toBe('pre-connect-key');
      } finally {
        el.remove();
      }
    });
  });
});
