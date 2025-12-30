import { defineConfig } from 'eslint/config';
import { configs as litConfigs } from 'eslint-plugin-lit';
import { configs as wcConfigs } from 'eslint-plugin-wc';
import tseslint from 'typescript-eslint';

const SRC_GLOB = 'src/**/*.ts';

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
]);
