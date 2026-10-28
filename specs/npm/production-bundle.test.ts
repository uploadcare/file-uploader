import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { afterAll, expect, test } from 'vitest';

// A consumer's production build of the npm package: `exports` resolves to `dist/`, and its npm dependencies (Lit
// included) come in as their production builds, minified together. Dev servers and the `web/` bundles never see this
// combination, so the e2e suite can't catch a `dist/` that only breaks once a bundler minifies it with its deps.
const root = resolve(import.meta.dirname, '../..');
// Inside the package, so the bare import self-resolves through `exports` as it would from a consumer's app.
const outDir = join(import.meta.dirname, '.production-bundle');
await mkdir(outDir, { recursive: true });
afterAll(() => rm(outDir, { recursive: true, force: true }));

test('a production bundle of the npm package renders the uploader', async () => {
  const entry = join(outDir, 'entry.js');
  await writeFile(
    entry,
    `import * as UC from '@uploadcare/file-uploader';
UC.defineComponents(UC);`,
  );
  // Vite picks each dependency's `production` export condition from NODE_ENV, which Vitest sets to `test`; left alone,
  // Lit would come in as its dev build, the one combination that hides the bug this guards against.
  const nodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    mode: 'production',
    build: {
      outDir: join(outDir, 'dist'),
      emptyOutDir: true,
      lib: { entry, formats: ['es'], fileName: 'bundle' },
    },
  }).finally(() => {
    process.env.NODE_ENV = nodeEnv;
  });
  await import(pathToFileURL(join(outDir, 'dist/bundle.js')).href);

  document.body.innerHTML = `
    <uc-config ctx-name="prod" pubkey="demopublickey"></uc-config>
    <uc-file-uploader-regular ctx-name="prod"></uc-file-uploader-regular>
    <uc-upload-ctx-provider ctx-name="prod"></uc-upload-ctx-provider>`;
  const uploader = document.querySelector('uc-file-uploader-regular') as HTMLElement & {
    updateComplete: Promise<boolean>;
  };
  await uploader.updateComplete;

  expect(uploader.querySelector('uc-simple-btn')).not.toBeNull();
});
