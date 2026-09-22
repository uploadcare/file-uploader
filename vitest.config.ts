import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { commands } from './tests/utils/commands';
import { isLive } from './tests/utils/network';

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
      // Repeated full runs against the fake now measure 88.03/76.36/92.33/88.20
      // exactly, because which code paths run no longer depends on how quickly
      // the upload API happens to answer. The floor keeps ~1pp under that, for
      // the live runs on release branches and for whatever a different machine
      // does with the camera and video paths.
      thresholds: {
        statements: 87,
        branches: 75,
        functions: 91,
        lines: 87,
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
          name: 'types',
          include: ['./types/test/**/*.test-d.tsx'],
          // Type-only: the files are compiled by tsc against the built `dist/index.d.ts`, never executed. Run `npm run
          // build` first, as `test:types` does in CI.
          typecheck: {
            enabled: true,
            only: true,
            include: ['./types/test/**/*.test-d.tsx'],
            tsconfig: './tsconfig.types-test.json',
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          setupFiles: ['./tests/setup.e2e.ts'],
          include: ['./**/*.e2e.test.ts', './**/*.e2e.test.tsx'],
          // Nothing to retry when the network is the fake in `tests/utils/fake-uploadcare`:
          // it answers the same way every time, so a second attempt would only hide a
          // real flake. A live run still races the real API, and still gets one.
          retry: isLive ? 1 : 0,
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
