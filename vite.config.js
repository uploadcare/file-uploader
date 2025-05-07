import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

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
