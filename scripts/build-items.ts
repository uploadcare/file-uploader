import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LibraryOptions } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SRC_PATH = resolve(__dirname, '../src');

export const srcPath = (subpath: string) => resolve(SRC_PATH, subpath);
export const outPath = (subpath: string) => resolve(__dirname, '..', subpath);

export const localeFiles = await readdir(srcPath('./locales/file-uploader/'));

export interface BuildItem {
  entry: LibraryOptions['entry'];
  outDir: string;
  format: 'esm' | 'iife';
  minify: boolean;
  filename?: string;
  cssFilename?: string;
  bundleExternalDependencies: boolean;
  mangleProps?: boolean;
  codeSplitting?: boolean;
}

export const buildItems: BuildItem[] = [
  {
    entry: [
      srcPath('./index.ts'),
      srcPath('./abstract/loadFileUploaderFrom.ts'),
      srcPath('./env.ts'),
      srcPath('./solutions/cloud-image-editor/index.ts'),
      ...localeFiles.map((f) => srcPath(`./locales/file-uploader/${f}`)),
    ],
    outDir: outPath('./dist/'),
    format: 'esm',
    minify: true,
    bundleExternalDependencies: false,
    mangleProps: false,
    codeSplitting: true,
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
    cssFilename: 'uc-cloud-image-editor.min.css',
    format: 'esm',
    minify: true,
    bundleExternalDependencies: true,
    mangleProps: true,
  },
  // file-uploader-regular
  {
    entry: {
      'uc-file-uploader-regular.min': srcPath('./solutions/file-uploader/regular/index.ts'),
    },
    outDir: outPath('./web'),
    cssFilename: 'uc-file-uploader-regular.min.css',
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
    cssFilename: 'uc-file-uploader-inline.min.css',
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
    cssFilename: 'uc-file-uploader-minimal.min.css',
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
