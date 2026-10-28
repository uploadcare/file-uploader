import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Options } from 'tsup';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SRC_PATH = resolve(__dirname, '../src');

const srcPath = (subpath: string) => resolve(SRC_PATH, subpath);
const outPath = (subpath: string) => resolve(__dirname, '..', subpath);

const localeFiles = await readdir(srcPath('./locales/file-uploader/'));

export interface BuildItem {
  entry: Options['entry'];
  outDir: string;
  format: 'esm' | 'iife';
  minify: boolean;
  filename?: string;
  cssFilename?: string;
  bundleExternalDependencies: boolean;
  mangleProps?: boolean;
  /** Source modules this bundle must not contain; the build fails naming the first one found. */
  forbiddenModules?: RegExp[];
}

export const buildItems: BuildItem[] = [
  {
    entry: [
      srcPath('./index.ts'),
      srcPath('./abstract/loadFileUploaderFrom.ts'),
      srcPath('./env.ts'),
      ...localeFiles.map((f) => srcPath(`./locales/file-uploader/${f}`)),
    ],
    outDir: outPath('./dist/'),
    format: 'esm',
    minify: true,
    bundleExternalDependencies: false,
    // No `mangleProps` here, unlike `web/`: `lit` stays external, so esbuild can't see the short names Lit's own
    // production build uses and hands the same ones to our `_` fields (`_lifetime` became `C` and replaced one of
    // Lit's methods). `specs/npm/production-bundle.test.ts` builds a consumer's production bundle to catch it.
  },
  // uc-blocks
  {
    entry: { 'file-uploader.min': srcPath('./index.ts') },
    outDir: outPath('./web'),
    cssFilename: 'uc-basic.min.css',
    format: 'esm',
    minify: true,
    bundleExternalDependencies: true,
    mangleProps: true,
  },
  {
    entry: { 'file-uploader.iife.min': srcPath('./index.ts') },
    outDir: outPath('./web'),
    cssFilename: 'uc-basic.min.css',
    format: 'iife',
    minify: true,
    bundleExternalDependencies: true,
    mangleProps: true,
  },
  // uc-cloud-image-editor
  {
    entry: {
      'uc-cloud-image-editor.min': srcPath('./solutions/cloud-image-editor/index.ts'),
    },
    outDir: outPath('./web'),
    format: 'esm',
    minify: true,
    bundleExternalDependencies: true,
    mangleProps: true,
    // The standalone editor uploads nothing: the upload stack must stay out of it. `@uploadcare/upload-client` itself
    // can't be listed: the editor takes two small helpers from it (`Queue`, `isAuthTokenResolver`), and the package
    // is one bundled file, so the metafile can't tell them from its upload functions.
    forbiddenModules: [
      /src\/abstract\/UploaderPublicApi\.ts$/,
      /src\/abstract\/managers\/plugin\/PluginController\.ts$/,
      /src\/abstract\/controllers\/UploadController\.ts$/,
      /src\/abstract\/controllers\/registerUploadStack\.ts$/,
    ],
  },
  // file-uploader-regular
  {
    entry: {
      'uc-file-uploader-regular.min': srcPath('./solutions/file-uploader/regular/index.ts'),
    },
    outDir: outPath('./web'),
    format: 'esm',
    minify: true,
    bundleExternalDependencies: true,
    mangleProps: true,
  },
  // file-uploader-inline
  {
    entry: {
      'uc-file-uploader-inline.min': srcPath('./solutions/file-uploader/inline/index.ts'),
    },
    outDir: outPath('./web'),
    format: 'esm',
    minify: true,
    bundleExternalDependencies: true,
    mangleProps: true,
  },
  // file-uploader-minimal
  {
    entry: {
      'uc-file-uploader-minimal.min': srcPath('./solutions/file-uploader/minimal/index.ts'),
    },
    outDir: outPath('./web'),
    format: 'esm',
    minify: true,
    bundleExternalDependencies: true,
    mangleProps: true,
  },
  // uc-img
  {
    entry: { 'uc-img.min': srcPath('./solutions/adaptive-image/index.ts') },
    outDir: outPath('./web'),
    format: 'esm',
    minify: true,
    bundleExternalDependencies: true,
    mangleProps: true,
  },
];
