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
          environment: 'happy-dom',
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['./**/*.e2e.test.ts', './**/*.e2e.test.tsx'],
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
