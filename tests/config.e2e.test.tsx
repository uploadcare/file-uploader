import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { Config } from '@/index';
import '../types/jsx';
import { inCtx, renderSolution } from './utils/render-solution';
import { cleanup, getCtxName } from './utils/test-renderer';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

let config: Config;

beforeEach(async () => {
  // No pubkey: these tests set it themselves and watch what `cdnCname` derives from it.
  ({ config } = await renderSolution('regular', {}, { pubkey: null }));
});

describe('Config', () => {
  describe('cdnCname', () => {
    it('should be ucarecdn.com by default', async () => {
      expect(config.cdnCname).toBe('https://ucarecdn.com');
    });

    it('should be updated synchronously', async () => {
      config.cdnCname = 'https://cdn.example.com';
      expect(config.cdnCname).toBe('https://cdn.example.com');
    });

    it('should be async calculated from pubkey if another custom domain is not set', async () => {
      config.pubkey = 'demopublickey';
      expect(config.cdnCname).toBe('https://ucarecdn.com');
      await expect.poll(() => config.cdnCname).toBe('https://1s4oyld5dc.ucarecd.net');
    });

    it('should not be calculated if another custom domain is set', async () => {
      config.cdnCname = 'https://cdn.example.com';
      config.pubkey = 'demopublickey';
      await expect.poll(() => config.cdnCname).toBe('https://cdn.example.com');
    });

    it('should be calculated if pubkey is changed and custom domain is not present', async () => {
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

      // This test renders its own uploader, so it reads that one rather than the fixture's.
      expect(inCtx<Config>('uc-config', ctxName).cdnCname).toBe('https://cdn.example.com');
    });
  });
});
