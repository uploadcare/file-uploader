import { defineConfig } from 'eslint/config';
import { configs as litConfigs } from 'eslint-plugin-lit';
import { configs as wcConfigs } from 'eslint-plugin-wc';
import tseslint from 'typescript-eslint';

const SRC_GLOB = 'src/**/*.ts';
const TESTS_GLOB = 'tests/**/*.{ts,tsx}';

const BASE_CLASSES = [
  'LitElement',
  'LitBlock',
  'LitActivityBlock',
  'LitUploaderBlock',
  'LitSolutionBlock',
  'EditorButtonControl',
  'FileItemConfig',
  'ImgBase',
  'ImgConfig',
];

export default defineConfig([
  {
    ...litConfigs['flat/recommended'],
    files: [SRC_GLOB],
  },
  {
    ...wcConfigs['flat/recommended'],
    files: [SRC_GLOB],
  },
  {
    ...tseslint.configs.recommended[0],
    files: [SRC_GLOB],
  },
  {
    files: [SRC_GLOB],
    settings: {
      wc: {
        elementBaseClasses: BASE_CLASSES,
      },
      lit: {
        elementBaseClasses: BASE_CLASSES,
      },
    },
  },
  {
    files: [SRC_GLOB],
    rules: {
      'wc/no-self-class': 'warn', // TODO: We should get rid of self class assignment
      'wc/no-constructor-attributes': 'warn', // TODO: We should move attribute definitions out of constructor
    },
  },
  {
    // An `expect.poll` / `expect.element` / `click()` without `await` passes before it has checked anything.
    files: [TESTS_GLOB],
    ignores: ['tests/__coverage__/**'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: './tsconfig.e2e-test.json', tsconfigRootDir: import.meta.dirname },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
]);
