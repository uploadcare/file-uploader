import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import '../types/jsx';
// biome-ignore lint/correctness/noUnusedImports: Used in JSX
import { cleanup, getCtxName, renderer } from './utils/test-renderer';

beforeAll(async () => {
  // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
  // @ts-ignore
  await import('@/solutions/file-uploader/regular/index.css');
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
});
