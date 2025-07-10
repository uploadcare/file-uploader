import { EventPayload } from '@/types';
import { page } from '@vitest/browser/context';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../types/jsx';
import { renderer } from './utils/test-renderer';

beforeAll(async () => {
  await import('@/solutions/file-uploader/regular/index.css');
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = `test-${Math.random().toString(36).slice(2)}`;
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
});

describe('API', () => {
  it('should somehow work', async () => {
    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<UploadCtxProvider>;
    const api = uploadCtxProvider.api;

    const eventHandler = vi.fn<(e: CustomEvent<EventPayload['file-added']>) => void>();

    uploadCtxProvider.addEventListener('file-added', eventHandler);

    const url =
      'https://images.unsplash.com/photo-1699102241946-45c5e1937d69?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&dl=prithiviraj-a-fa7Stge3YXs-unsplash.jpg&w=640';
    api.addFileFromUrl(url);

    const eventPayload = await vi.waitFor(() => {
      expect(eventHandler).toHaveBeenCalled();
      return eventHandler.mock.calls[0][0].detail;
    });

    expect(eventPayload).toMatchObject(expect.objectContaining({ status: 'idle', externalUrl: url }));
  });
});
