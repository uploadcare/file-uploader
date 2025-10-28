import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { commands } from './tests/utils/commands';

const __dirname = dirname(fileURLToPath(import.meta.url));

const alias = {
  '@': resolve(__dirname, 'src'),
  '~': __dirname,
};

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      build: {
        target: 'esnext',
      },
      test: {
        coverage: {
          provider: 'v8',
          reporter: ['text', 'html'],
          reportsDirectory: './tests/__coverage__',
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
              browser: {
                enabled: true,
                provider: 'playwright',
                instances: [
                  {
                    browser: 'chromium',
                    launch: {
                      args: [
                        '--disable-web-security',
                        '--use-fake-ui-for-media-stream',
                        '--use-fake-device-for-media-stream',
                      ],
                    },
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
      resolve: {
        alias,
      },
    };
  }

  throw new Error('Not implemented');
});
