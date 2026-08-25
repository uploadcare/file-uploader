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
    // Force esbuild's decorator transform to the experimental (legacy) mode so
    // it deterministically matches `tsc`. Without this, the solution-style root
    // tsconfig leaves esbuild's inferred decorator mode ambiguous for `src`
    // files; the DI `@inject`/`@signalState` decorators require the legacy
    // transform, and every existing Lit decorator is happy with it too.
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './tests/__coverage__',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.*', '**/vite.config.js', './src/locales/**', './dist/**'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'specs',
          // Rooted at the directories tests actually live in, not `./**`. A
          // repo-wide glob also collected `.claude/worktrees/<branch>/` — a full
          // second checkout when an agent works in a git worktree — which doubled
          // the suite and surfaced an unrelated branch's failures as ours.
          include: ['./specs/*/*.test.ts', './src/**/*.test.{ts,js}'],
          environment: 'happy-dom',
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          // Browser e2e lives only under `tests/` — see the note on the specs
          // project for why this is rooted rather than `./**`.
          include: ['./tests/**/*.e2e.test.{ts,tsx}'],
          // Browser e2e tests can flake under full parallel load (e.g. the
          // cloud-image-editor `uc-crop-frame` locator loses a render race
          // that passes reliably in isolation). Retry once so a transient
          // flake can't fail the gate; a genuine regression still fails both
          // attempts.
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
