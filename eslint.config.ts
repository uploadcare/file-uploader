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
      // All logging must go through the centralized logger (`src/abstract/logger.ts`)
      // so verbosity/prefixing stay uniform and the editor bundle stays lean.
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          // Forbid inline `logger.scope('x').warn(...)` — create ONE scoped
          // logger at the top of the file/class and reuse it.
          selector:
            "CallExpression[callee.object.callee.property.name='scope'][callee.object.callee.object.name='logger']",
          message:
            "Don't chain a log call on logger.scope(...). Create one scoped logger at the top (`const log = logger.scope('my-scope')`) and reuse it.",
        },
        {
          // Forbid bare `logger.warn/error/debug/...` — go through a scoped logger.
          // `logger.scope(...)` (assigning a scope) is allowed.
          selector: "CallExpression[callee.object.name='logger'][callee.property.name!='scope']",
          message:
            "Don't call log methods on the base `logger`. Create a scoped logger (`const log = logger.scope('my-scope')`) and call methods on it.",
        },
      ],
    },
  },
  {
    // The logger itself is the single sanctioned `console.*` implementation.
    files: ['src/abstract/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Tests legitimately spy on / stub `console.*` and exercise the base logger
    // API directly (bare `logger.warn`, inline `logger.scope(...).debug(...)`).
    files: ['src/**/*.test.ts', 'src/**/*.test.js'],
    rules: {
      'no-console': 'off',
      'no-restricted-syntax': 'off',
    },
  },
]);
