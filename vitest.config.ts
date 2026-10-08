import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { msw } from 'msw/vite';
import { defineConfig } from 'vitest/config';
import { commands } from './tests/utils/commands';
import { isLive, mode } from './tests/utils/network';

const __dirname = dirname(fileURLToPath(import.meta.url));

const alias = {
  '@': resolve(__dirname, 'src'),
  '~': __dirname,
};

export default defineConfig({
  resolve: {
    alias,
  },
  oxc: {
    // Oxc's dev JSX transform adds `__self`/`__source` props even on the classic runtime, and render-jsx would set
    // them as attributes; esbuild's never did.
    jsx: { development: false },
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
        // Vitest still reads these files through Vite to find the tests in them, and Vite 8's Oxc honours the nearest
        // tsconfig's `jsx: "preserve"` (tsconfig.test.json), which leaves JSX it cannot parse. Use the typecheck's own.
        tsconfig: './tsconfig.types-test.json',
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
        // Serves `/mockServiceWorker.js` from the installed msw for `tests/utils/emulator.browser.ts`. The emulator
        // builds its own network, so only the worker script is needed here.
        plugins: [msw({ mode: 'worker-only' })],
        test: {
          name: 'e2e',
          setupFiles: ['./tests/setup.e2e.ts'],
          // Reaches the page as `import.meta.env.E2E_NET`: vitest defines `env` into the browser bundle.
          env: { E2E_NET: mode },
          include: ['./**/*.e2e.test.ts', './**/*.e2e.test.tsx'],
          // Nothing to retry when the network is the emulator (`@uploadcare/api-emulator`, run in the page by
          // `tests/utils/emulator.browser.ts`): it answers the same way every time, so a second attempt would only
          // hide a real flake. A live run still races the real API, and still gets one.
          retry: isLive ? 1 : 0,
          expect: {
            poll: {
              timeout: 20_000,
            },
          },
          browser: {
            enabled: true,
            // Vitest's default is headless only under CI, so a local run opens a real window with the Vitest UI, and
            // whatever the desktop does to it (a click, a focus change, a drag on the UI's splitter) lands in the
            // tests. `test:e2e:dev` turns it back on to watch a run.
            headless: true,
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
