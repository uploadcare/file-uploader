import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';
import { commands } from './tests/utils/commands';

const __dirname = dirname(fileURLToPath(import.meta.url));

const alias = {
  '@': resolve(__dirname, 'src'),
  '~': __dirname,
};

/**
 * Both projects glob `./**` for tests, which also reaches agent scratch space —
 * `.claude/worktrees/<branch>/` holds a full second checkout when a coding agent
 * works in a git worktree, so its copy of every spec gets collected too. That
 * silently doubles the suite and reports failures from an unrelated branch as if
 * they were ours. Vitest's default excludes cover `node_modules`/`dist` but not this.
 */
const AGENT_SCRATCH = ['**/.claude/**', '**/.superpowers/**'];

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
          include: ['./specs/npm/*.test.ts', './**/*.test.{ts,js}'],
          exclude: [...configDefaults.exclude, ...AGENT_SCRATCH],
          environment: 'happy-dom',
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['./**/*.e2e.test.ts', './**/*.e2e.test.tsx'],
          exclude: [...configDefaults.exclude, ...AGENT_SCRATCH],
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
