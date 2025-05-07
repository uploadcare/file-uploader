import path from 'node:path';
import { BrowserCommand } from 'vitest/node';

export const waitFileChooserAndUpload: BrowserCommand<[string[]]> = async ({ page, testPath }, relativePaths) => {
  if (!testPath) {
    throw new Error('Test path is not defined');
  }
  const fileChooserPromise = page.waitForEvent('filechooser');
  const fileChooser = await fileChooserPromise;
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(path.dirname(testPath), relativePath);
    await fileChooser.setFiles(absolutePath);
  }
};

export const commands = {
  waitFileChooserAndUpload,
};

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    waitFileChooserAndUpload: (relativePaths: string[]) => Promise<void>;
  }
}
