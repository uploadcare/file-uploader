import { page } from '@vitest/browser/context';
import { describe, expect, test } from 'vitest';
import '../types/jsx';
import { getCtxName } from './utils/getCtxName';
// biome-ignore lint/correctness/noUnusedImports: Used in JSX
import { renderer } from './utils/test-renderer';

/**
 * Those tests are for the bundles to make sure that they work correctly:
 * No errors, can be imported, components can be defined and used.
 */
describe('Bundles', () => {
  test('dist/env', async () => {
    const env = await import('~/dist/env.js');
    expect(env.PACKAGE_NAME).toBe('blocks');
    expect(env.PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+(-.+)?$/);
  });

  test('dist/abstract/loadFileUploaderFrom.js', async () => {
    // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
    // @ts-ignore
    await import('~/web/uc-basic.min.css');
    const { loadFileUploaderFrom } = await import('~/dist/abstract/loadFileUploaderFrom.js');
    const { default: moduleUrl } = await import('~/web/file-uploader.iife.min.js?url');

    const UC = await loadFileUploaderFrom(moduleUrl);
    expect(UC).toBeDefined();
    if (!UC) return;
    UC.defineComponents(UC);

    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );

    await expect.element(page.getByText('Upload files', { exact: true })).toBeVisible();
  });

  test('dist/index.js', async () => {
    // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
    // @ts-ignore
    await import('~/dist/index.css');
    const UC = await import('~/dist/index.js');

    UC.defineComponents(UC);

    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );

    await expect.element(page.getByText('Upload files', { exact: true })).toBeVisible();
  });

  test('web/file-uploader.iife.min.js', async () => {
    // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
    // @ts-ignore
    await import('~/web/uc-basic.min.css');
    const { default: scriptUrl } = await import('~/web/file-uploader.iife.min.js?url');
    const script = document.createElement('script');
    script.src = scriptUrl;
    document.head.appendChild(script);
    await new Promise((resolve) => {
      script.onload = resolve;
    });

    const UC = (globalThis as any).UC;
    UC.defineComponents(UC);

    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );

    await expect.element(page.getByText('Upload files', { exact: true })).toBeVisible();
  });

  test('web/file-uploader.min.js', async () => {
    // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
    // @ts-ignore
    await import('~/web/uc-basic.min.css');
    const UC = await import('~/web/file-uploader.min.js');

    UC.defineComponents(UC);

    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );

    await expect.element(page.getByText('Upload files', { exact: true })).toBeVisible();
  });

  test('web/uc-cloud-image-editor.min.js', async () => {
    // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
    // @ts-ignore
    await import('~/web/uc-cloud-image-editor.min.css');
    const UC = await import('~/web/uc-cloud-image-editor.min.js');

    UC.defineComponents(UC);

    const ctxName = getCtxName();
    page.render(
      <>
        <uc-cloud-image-editor ctx-name={ctxName} uuid="90e06e59-8055-4435-9291-c005a98cf098"></uc-cloud-image-editor>
        <uc-config ctx-name={ctxName} pubkey="364c0864158c27472ffe" testMode></uc-config>
      </>,
    );

    // TODO: For some reason, toBeVisible() doesn't work here
    await expect.element(page.getByTestId('uc-crop-frame')).toBeInTheDocument();
  });

  test('web/uc-file-uploader-inline.min.js', async () => {
    // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
    // @ts-ignore
    await import('~/web/uc-file-uploader-inline.min.css');
    const UC = await import('~/web/uc-file-uploader-inline.min.js');

    UC.defineComponents(UC);

    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-inline ctx-name={ctxName}></uc-file-uploader-inline>
        <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );

    await expect.element(page.getByText('From device', { exact: true })).toBeVisible();
  });

  test('web/uc-file-uploader-minimal.min.js', async () => {
    // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
    // @ts-ignore
    await import('~/web/uc-file-uploader-minimal.min.css');
    const UC = await import('~/web/uc-file-uploader-minimal.min.js');

    UC.defineComponents(UC);

    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-minimal ctx-name={ctxName}></uc-file-uploader-minimal>
        <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );

    await expect.element(page.getByText('Choose file', { exact: true })).toBeVisible();
  });

  test('web/uc-file-uploader-regular.min.js', async () => {
    // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
    // @ts-ignore
    await import('~/web/uc-file-uploader-regular.min.css');
    const UC = await import('~/web/uc-file-uploader-regular.min.js');

    UC.defineComponents(UC);

    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );

    await expect.element(page.getByText('Upload files', { exact: true })).toBeVisible();
  });

  test('web/uc-img.min.js', async () => {
    // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
    // @ts-ignore
    await import('~/web/uc-img.min.js');

    page.render(<uc-img uuid="90e06e59-8055-4435-9291-c005a98cf098"></uc-img>);

    await expect
      .poll(() =>
        document.querySelector('uc-img > img')?.getAttribute('src')?.includes('90e06e59-8055-4435-9291-c005a98cf098'),
      )
      .toBe(true);
  });
});
