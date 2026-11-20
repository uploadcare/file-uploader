import { expect } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '~/types/jsx';
import { IMAGE } from '~/tests/fixtures/files';
import { getCtxName } from '~/tests/utils/test-renderer';

export type WebBundle = typeof import('~/web/file-uploader.min.js');

/**
 * Uploads a file through the bundle's `getAPI()`, waits for the emulator to store it, then rotates it in the cloud
 * image editor and applies. Loading a bundle only proves it parses; this runs its minified upload stack and editor.
 * Run it from a `*.bundle.e2e.test.tsx` file, which `tests/setup.e2e.ts` leaves for the bundle to register.
 */
export const uploadAndEdit = async (UC: WebBundle) => {
  UC.defineComponents(UC);
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
  await expect.element(page.getByText('Upload files', { exact: true })).toBeVisible();
  const provider = document.querySelector(`uc-upload-ctx-provider[ctx-name="${ctxName}"]`);
  // The bundle's class, not the source's: the setup registered nothing for this file.
  expect(provider).toBeInstanceOf(UC.UploadCtxProvider);
  const api = (provider as InstanceType<WebBundle['UploadCtxProvider']>).getAPI();

  const { internalId } = api.addFileFromObject(IMAGE.SQUARE);
  await expect.poll(() => api.getOutputItem(internalId).isSuccess).toBe(true);

  api.setCurrentActivity('cloud-image-edit', { internalId });
  api.setModalState(true);
  // Rotate is the first crop button.
  await userEvent.click(page.getByTestId('uc-editor-crop-button-control').nth(0));
  await userEvent.click(page.getByRole('button', { name: /apply/i }));

  await expect.poll(() => api.getOutputItem(internalId).cdnUrlModifiers).toContain('/rotate/90/');
};
