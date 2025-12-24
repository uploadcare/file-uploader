import { page } from '@vitest/browser/context';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventPayload } from '@/index.js';
import '../types/jsx';
// biome-ignore lint/correctness/noUnusedImports: Used in JSX
import { renderer } from './utils/test-renderer';

beforeAll(async () => {
  // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
  // @ts-ignore
  await import('@/solutions/file-uploader/regular/index.css');
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = `test-${Math.random().toString(36).slice(2)}`;
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
});

describe('API', () => {
  it('should emit events', async () => {
    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
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

  it('should not duplicate events after uploader add/removal', async () => {
    for (let i = 0; i < 5; i++) {
      const uploader = page.getByTestId('uc-file-uploader-regular').query()!;
      uploader.remove();

      page.render(<uc-file-uploader-regular ctx-name={uploader.getAttribute('ctx-name')!}></uc-file-uploader-regular>);
    }

    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = uploadCtxProvider.api;

    const eventHandler = vi.fn<(e: CustomEvent<EventPayload['file-added']>) => void>();

    uploadCtxProvider.addEventListener('file-added', eventHandler);

    const url =
      'https://images.unsplash.com/photo-1699102241946-45c5e1937d69?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&dl=prithiviraj-a-fa7Stge3YXs-unsplash.jpg&w=640';
    api.addFileFromUrl(url);

    const eventPayload = await vi.waitFor(() => {
      expect(eventHandler).toHaveBeenCalledOnce();
      return eventHandler.mock.calls[0][0].detail;
    });

    expect(eventPayload).toMatchObject(expect.objectContaining({ status: 'idle', externalUrl: url }));
  });

  it('should emit events after uploader re-mount', async () => {
    const uploader = page.getByTestId('uc-file-uploader-regular').query()!;
    for (let i = 0; i < 5; i++) {
      uploader.remove();
      page.render(uploader);
    }

    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = uploadCtxProvider.api;

    const eventHandler = vi.fn<(e: CustomEvent<EventPayload['file-added']>) => void>();

    uploadCtxProvider.addEventListener('file-added', eventHandler);

    const url =
      'https://images.unsplash.com/photo-1699102241946-45c5e1937d69?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&dl=prithiviraj-a-fa7Stge3YXs-unsplash.jpg&w=640';
    api.addFileFromUrl(url);

    const eventPayload = await vi.waitFor(() => {
      expect(eventHandler).toHaveBeenCalledOnce();
      return eventHandler.mock.calls[0][0].detail;
    });

    expect(eventPayload).toMatchObject(expect.objectContaining({ status: 'idle', externalUrl: url }));
  });

  it('should set cloud-image-edit activity with params', async () => {
    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = uploadCtxProvider.getAPI();

    const url =
      'https://images.unsplash.com/photo-1699102241946-45c5e1937d69?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&dl=prithiviraj-a-fa7Stge3YXs-unsplash.jpg&w=640';
    api.addFileFromUrl(url);

    const eventHandler = (event: CustomEvent<EventPayload['file-upload-success']>) => {
      const detail = event.detail as EventPayload['file-upload-success'];
      api.setCurrentActivity('cloud-image-edit', { internalId: detail.internalId });
      api.setModalState(true);
    };

    uploadCtxProvider.addEventListener('file-upload-success', eventHandler);

    const startFrom = page.getByTestId('uc-start-from');
    const cloudImageEdit = page.getByTestId('uc-cloud-image-editor-activity');
    await expect.element(startFrom).not.toBeVisible();
    await expect.element(cloudImageEdit).toBeVisible();
  });
});
