import { AuthTokenResolverError, NetworkError, UploadError } from '@uploadcare/upload-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { delay } from '@/utils/delay';
import { IMAGE } from '~/tests/fixtures/files';
import { renderSolution } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * What a failed upload reports. `uploadFile` is stubbed with the error under
 * test, so this pins the classification (FileItem's catch plus
 * `validateUploadError`) rather than the network: which `type` an integrator
 * branches on, and whether the thrown error survives to `payload.error`.
 */

const uploadFile = vi.hoisted(() => vi.fn());
const uploadFileGroup = vi.hoisted(() => vi.fn());

vi.mock('@uploadcare/upload-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uploadcare/upload-client')>();
  return { ...actual, uploadFile, uploadFileGroup };
});

/** Enough of an `UploadcareFile` for an entry to reach `success`. */
const UPLOADED = {
  uuid: '00000000-0000-4000-8000-000000000000',
  originalFilename: 'pixel.jpg',
  name: 'pixel.jpg',
  size: 1,
  isImage: true,
  mimeType: 'image/jpeg',
  isStored: true,
  cdnUrl: 'https://ucarecdn.com/00000000-0000-4000-8000-000000000000/',
} as unknown as Awaited<ReturnType<typeof import('@uploadcare/upload-client').uploadFile>>;

beforeEach(() => {
  uploadFile.mockReset();
  uploadFileGroup.mockReset();
});

/** Uploads one file that fails with `error`, and returns the entry's errors. */
const errorsFor = async (error: unknown) => {
  uploadFile.mockRejectedValue(error);
  const { api } = await renderSolution('regular', {});
  api.addFileFromObject(IMAGE.PIXEL);
  api.uploadAll();

  await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.errors.length).toBeGreaterThan(0);
  return api.getOutputCollectionState().allEntries[0].errors;
};

describe('a failed upload', () => {
  it('reports a failing auth token function as AUTH_TOKEN_ERROR', async () => {
    const cause = new Error('token endpoint is down');
    const error = new AuthTokenResolverError(cause);

    const [reported] = await errorsFor(error);

    expect(reported.type).toBe('AUTH_TOKEN_ERROR');
    // Narrowed rather than cast, so the payload is typed as the union member
    // says it is.
    const authTokenError = reported.type === 'AUTH_TOKEN_ERROR' ? reported : undefined;
    // The class itself, not a re-wrap: the integrator reaches `cause` through
    // it to find out what their own endpoint did.
    expect(authTokenError?.payload?.error).toBe(error);
    expect(authTokenError?.payload?.error.cause).toBe(cause);
    expect(reported.message).toBe(error.message);
  });

  it('reports an Upload API rejection as UPLOAD_ERROR', async () => {
    const error = new UploadError('Expired token.', 'AccessTokenExpiredError');

    const [reported] = await errorsFor(error);

    expect(reported.type).toBe('UPLOAD_ERROR');
    expect(reported.type === 'UPLOAD_ERROR' ? reported.payload?.error : undefined).toBe(error);
  });

  it('reports a dead connection as NETWORK_ERROR', async () => {
    const error = new NetworkError(new ProgressEvent('error'));

    const [reported] = await errorsFor(error);

    expect(reported.type).toBe('NETWORK_ERROR');
  });

  it('falls back to UNKNOWN_ERROR for anything else', async () => {
    const [reported] = await errorsFor(new Error('something nobody classified'));

    expect(reported.type).toBe('UNKNOWN_ERROR');
  });
});

describe('a failed group creation', () => {
  it('reports GROUP_ERROR rather than failing silently', async () => {
    // `_createGroup` is deliberately not awaited, so before this the rejection
    // was unhandled and the output simply had no group.
    const error = new AuthTokenResolverError(new Error('token endpoint is down'));
    uploadFile.mockResolvedValue(UPLOADED);
    uploadFileGroup.mockRejectedValue(error);

    const { api } = await renderSolution('regular', {
      multiple: true,
      groupOutput: true,
    });
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    await expect.poll(() => api.getOutputCollectionState().errors.length).toBeGreaterThan(0);
    const [reported] = api.getOutputCollectionState().errors;

    expect(reported.type).toBe('GROUP_ERROR');
    expect(reported.type === 'GROUP_ERROR' ? reported.payload?.error : undefined).toBe(error);
    expect(reported.message).toBe(error.message);
    expect(api.getOutputCollectionState().group).toBeNull();
  });

  it('ignores a group that arrives for a collection that has since changed', async () => {
    // The success path used to compare `*collectionState`, which is republished
    // on a flush rather than on every change — so a group made from the old
    // file set was published as the collection's group, missing the new file.
    uploadFile.mockResolvedValue(UPLOADED);
    let resolveGroup: (group: unknown) => void = () => {};
    uploadFileGroup.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGroup = resolve;
        }),
    );

    const { api } = await renderSolution('regular', { multiple: true, groupOutput: true });
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await expect.poll(() => uploadFileGroup.mock.calls.length).toBeGreaterThan(0);

    api.addFileFromObject(IMAGE.PIXEL);
    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(2);
    await delay(100);

    resolveGroup({ uuid: 'group-uuid~1', cdnUrl: 'https://ucarecdn.com/group-uuid~1/' });
    await delay(100);

    expect(api.getOutputCollectionState().group).toBeNull();
  });

  it('ignores a group failure for a collection that has since changed', async () => {
    // The request cannot be cancelled, so a late rejection would otherwise
    // report against files it was never about.
    uploadFile.mockResolvedValue(UPLOADED);
    let rejectGroup: (reason: unknown) => void = () => {};
    uploadFileGroup.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectGroup = reject;
        }),
    );

    const { api } = await renderSolution('regular', { multiple: true, groupOutput: true });
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await expect.poll(() => uploadFileGroup.mock.calls.length).toBeGreaterThan(0);

    // A second file: a different collection, and a different group to make.
    // The collection observer runs a turn after the entry appears in the
    // output state, and the race is specifically a rejection arriving after
    // that observer, so this waits for the observer rather than the entry.
    api.addFileFromObject(IMAGE.PIXEL);
    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(2);
    await delay(100);

    rejectGroup(new Error('too late'));

    await expect.poll(() => api.getOutputCollectionState().errors).toBeDefined();
    expect(api.getOutputCollectionState().errors.some((error) => error.type === 'GROUP_ERROR')).toBe(false);
  });
});
