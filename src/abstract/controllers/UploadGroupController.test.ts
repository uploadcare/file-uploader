import { uploadFileGroup } from '@uploadcare/upload-client';
import { afterEach, expect, it, vi } from 'vitest';
import { delay } from '../../utils/delay';
import { ControllerContainer } from '../di/ControllerContainer';
import { __resetLoggerForTests } from '../logger';
import { CollectionStateController } from './CollectionStateController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadCollectionEventsController } from './UploadCollectionEventsController';
import { UploadController } from './UploadController';
import { UploadGroupController } from './UploadGroupController';

vi.mock('@uploadcare/upload-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uploadcare/upload-client')>();
  return { ...actual, uploadFileGroup: vi.fn() };
});

afterEach(() => {
  vi.restoreAllMocks();
  __resetLoggerForTests();
});

it('publishes the grouped collection state so a block reading it in a later task gets no late-read warning', async () => {
  const container = new ControllerContainer();
  container.get(UploadCollectionController).add({ fileInfo: { uuid: 'srv' } as never, uuid: 'srv' });
  vi.spyOn(container.get(UploadController), 'buildUploadOptions').mockResolvedValue({ publicKey: 'pk' });
  vi.mocked(uploadFileGroup).mockResolvedValue({ uuid: 'group~1', cdnUrl: 'https://cdn/group~1/' } as never);
  const collectionState = container.get(CollectionStateController);

  const state = container.get(UploadCollectionEventsController).flushOutput();
  await container.get(UploadGroupController).create(state, () => true);
  await delay(0);

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const published = collectionState.get('collectionState');
  expect(published?.group?.cdnUrl).toBe('https://cdn/group~1/');
  expect(published?.status).toBe('success');
  expect(warn).not.toHaveBeenCalled();
  container.dispose();
});
