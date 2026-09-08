import { beforeAll } from 'vitest';
import { commands } from 'vitest/browser';

beforeAll(async () => {
  await commands.useNetworkSnapshot();
});
