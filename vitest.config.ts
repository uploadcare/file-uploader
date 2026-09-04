import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { commands } from './tests/utils/commands';

const __dirname = dirname(fileURLToPath(import.meta.url));

const alias = {
  '@': resolve(__dirname, 'src'),
  '~': __dirname,
};

export default defineConfig({
  resolve: {
    alias,
  },
  esbuild: {
    jsxInject: "import { renderer } from '~/tests/utils/test-renderer';",
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './tests/__coverage__',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.*', '**/vite.config.js', './src/locales/**', './dist/**'],
      // A ratchet, not a target: raise these as coverage lands, never lower them
      // to make a run pass.
      //
      // They sit ~1pp under what the suite actually reaches, because the e2e
      // project uploads to the real API and which code paths run depends on
      // network timing — two consecutive full runs measured 78.95/65.30/85.50/78.91
      // and 78.12/64.71/84.38/78.11. Set a new floor from the *lowest* of several
      // runs, not the first one.
      thresholds: {
        statements: 77,
        branches: 63,
        functions: 83,
        lines: 77,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'specs',
          include: ['./specs/npm/*.test.ts', './**/*.test.{ts,js}'],
          environment: 'happy-dom',
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['./**/*.e2e.test.ts', './**/*.e2e.test.tsx'],
          // Every e2e test uploads to the real API, so a lost network race is not
          // a regression. A genuine break still fails both attempts.
          retry: 1,
          expect: {
            poll: {
              timeout: 20_000,
            },
          },
          browser: {
            enabled: true,
            provider: playwright({
              launchOptions: {
                args: [
                  '--disable-web-security',
                  '--use-fake-ui-for-media-stream',
                  '--use-fake-device-for-media-stream',
                ],
              },
            }),
            instances: [
              {
                browser: 'chromium',
              },
            ],
            commands: {
              ...commands,
            },
          },
        },
      },
    ],
  },
});
