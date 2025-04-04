import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: 'vite.config.js',
    test: {
      include: ['./**/*.e2e.test.ts', './**/*.e2e.test.tsx'],
      browser: {
        enabled: true,
        provider: 'playwright',
        instances: [{ browser: 'chromium' }],
      },
    },
  },
]);
