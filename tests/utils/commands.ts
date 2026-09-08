import path from 'node:path';
import type { BrowserCommand } from 'vitest/node';
import { useNetworkSnapshot } from './network-snapshot';

export const waitFileChooserAndUpload: BrowserCommand<[string[]]> = async ({ page, testPath }, relativePaths) => {
  if (!testPath) {
    throw new Error('Test path is not defined');
  }
  const fileChooserPromise = page.waitForEvent('filechooser');
  const fileChooser = await fileChooserPromise;
  const absolutePaths = relativePaths.map((relativePath) => path.join(path.dirname(testPath), relativePath));
  await fileChooser.setFiles(absolutePaths);
};

export const commands = {
  waitFileChooserAndUpload,
  useNetworkSnapshot,
};

declare module 'vitest/browser' {
  interface BrowserCommands {
    waitFileChooserAndUpload: (relativePaths: string[]) => Promise<void>;
    useNetworkSnapshot: () => Promise<void>;
  }
}
