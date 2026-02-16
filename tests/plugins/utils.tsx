import { beforeAll, expect } from 'vitest';
import { page } from 'vitest/browser';
import type { UploaderPlugin } from '@/index.ts';
// biome-ignore lint/correctness/noUnusedImports: Used in JSX
import { cleanup, getCtxName, renderer } from '../utils/test-renderer';

export { cleanup };

beforeAll(async () => {
  // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
  // @ts-ignore
  await import('@/solutions/file-uploader/regular/index.css');
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

export const TEST_IMAGE_URL =
  'https://images.unsplash.com/photo-1699102241946-45c5e1937d69?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&dl=prithiviraj-a-fa7Stge3YXs-unsplash.jpg&w=640';

/** Helper to create a minimal test plugin */
export function createTestPlugin(overrides: Partial<UploaderPlugin> & { id: string }): UploaderPlugin {
  return {
    version: '1.0.0',
    setup: () => {},
    ...overrides,
  };
}

/** Helper to render the uploader with given plugins set via JS property */
export async function renderUploader(plugins: UploaderPlugin[] = []) {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode debug></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  const config = page.getByTestId('uc-config').query()! as Config;
  config.plugins = plugins;
  return { ctxName, config };
}

/** Helper to get the UploadCtxProvider API */
export function getApi() {
  const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
  return uploadCtxProvider.api;
}

/** Helper to append a source to the source list */
export function addSource(config: Config, sourceId: string) {
  config.sourceList += `,${sourceId}`;
}

/** Helper to open the modal */
export async function openModal() {
  await page.getByText('Upload files', { exact: true }).click();
  await expect.element(page.getByTestId('uc-start-from')).toBeVisible();
}
