import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { commands } from './tests/utils/commands';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      build: {
        target: 'es2019',
      },
      test: {
        coverage: {
          provider: 'v8',
          reporter: ['text', 'html'],
          reportsDirectory: './tests/__coverage__',
        },
        projects: [
          {
            resolve: {
              alias: {
                '@': __dirname,
              },
            },
            test: {
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
        alias: {
          '@': __dirname,
        },
      },
    };
  }
  throw new Error('Not implemented');
});
