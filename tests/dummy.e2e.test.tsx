import { page } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import { render, renderer } from '../test-renderer';
import '../types/jsx';

test('dummy', async () => {
  import('@/solutions/file-uploader/regular/index.css');
  const UC = await import('@/index.js')
  UC.defineComponents(UC);

  render(
    <>
      <uc-file-uploader-regular ctx-name="my-uploader"></uc-file-uploader-regular>
      <uc-config ctx-name="my-uploader" pubkey="demopublickey"></uc-config>
      <uc-upload-ctx-provider ctx-name="my-uploader"></uc-upload-ctx-provider>
    </>,
  );

  await expect.element(page.getByText('Upload files')).toBeInTheDocument()
});
