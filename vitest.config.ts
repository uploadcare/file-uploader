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
      // network timing — full runs at this level have measured between
      // 87.76/76.31/91.82/87.96 and 88.18/77.00/92.28/88.38. Set a new floor
      // from the *lowest* of several runs, never from a single one.
      thresholds: {
        statements: 86,
        branches: 74,
        functions: 90,
        lines: 86,
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
