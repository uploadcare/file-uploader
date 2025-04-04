import { defineWorkspace } from 'vitest/config';
import { commands } from './tests/utils/commands';

export default defineWorkspace([
  {
    extends: 'vite.config.js',
    test: {
      include: ['./**/*.e2e.test.ts', './**/*.e2e.test.tsx'],
      browser: {
        enabled: true,
        provider: 'playwright',
        instances: [{ browser: 'chromium' }],
        commands
      },
    },
  },
]);
