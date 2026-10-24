import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

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
      resolve: {
        alias,
      },
      // Force esbuild's decorator transform to the experimental (legacy) mode so
      // it deterministically matches `tsc` (experimentalDecorators +
      // useDefineForClassFields:false). The solution-style root tsconfig makes
      // esbuild's inferred mode ambiguous for `src` files; pinning it here keeps
      // the DI `@inject`/`@signalState` decorators (and every Lit decorator)
      // transformed identically at runtime.
      esbuild: {
        tsconfigRaw: {
          compilerOptions: {
            experimentalDecorators: true,
            useDefineForClassFields: false,
          },
        },
      },
    };
  }

  throw new Error('Not implemented');
});
