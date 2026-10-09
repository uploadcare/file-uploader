import { AuthTokenResolverError, NetworkError, UploadError } from '@uploadcare/upload-client';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { withResolvers } from '@/utils/withResolvers';
import { IMAGE } from '~/tests/fixtures/files';
import { recordEvents } from '~/tests/utils/event-recorder';
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

    // Narrowed rather than cast, so the payload is typed as the union member
    // says it is.
    assert(reported.type === 'AUTH_TOKEN_ERROR', `expected AUTH_TOKEN_ERROR, got ${reported.type}`);
    // The class itself, not a re-wrap: the integrator reaches `cause` through
    // it to find out what their own endpoint did.
    expect(reported.payload?.error).toBe(error);
    expect(reported.payload?.error.cause).toBe(cause);
    expect(reported.message).toBe(error.message);
  });

  it('reports an Upload API rejection as UPLOAD_ERROR', async () => {
    const error = new UploadError('Expired token.', 'AccessTokenExpiredError');

    const [reported] = await errorsFor(error);

    assert(reported.type === 'UPLOAD_ERROR', `expected UPLOAD_ERROR, got ${reported.type}`);
    expect(reported.payload?.error).toBe(error);
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

    assert(reported.type === 'GROUP_ERROR', `expected GROUP_ERROR, got ${reported.type}`);
    expect(reported.payload?.error).toBe(error);
    expect(reported.message).toBe(error.message);
    expect(api.getOutputCollectionState().group).toBeNull();
  });

  it('ignores a group that arrives for a collection that has since changed', async () => {
    // The success path used to compare `*collectionState`, which is republished
    // on a flush rather than on every change — so a group made from the old
    // file set was published as the collection's group, missing the new file.
    uploadFile.mockResolvedValue(UPLOADED);
    const groups = holdGroupRequests();

    const { api, provider } = await renderSolution('regular', { multiple: true, groupOutput: true });
    const recorder = recordEvents(provider);
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await expect.poll(() => groups.length).toBe(1);

    // The race is a group arriving after the collection observer has seen the second file, which is when it emits
    // file-added. Auto-upload then makes the two-file collection its own group request.
    api.addFileFromObject(IMAGE.PIXEL);
    await expect.poll(() => recorder.detailsOf('file-added')).toHaveLength(2);
    await expect.poll(() => groups.length).toBe(2);

    // In this order, a stale group that was not dropped would be created first.
    groups[0].resolve({ uuid: 'stale-group~1', cdnUrl: 'https://ucarecdn.com/stale-group~1/' });
    groups[1].resolve({ uuid: 'current-group~2', cdnUrl: 'https://ucarecdn.com/current-group~2/' });
    await recorder.waitFor('group-created');

    expect(recorder.detailsOf('group-created').map((state) => state.group.uuid)).toEqual(['current-group~2']);
  });

  it('ignores a group failure for a collection that has since changed', async () => {
    // The request cannot be cancelled, so a late rejection would otherwise
    // report against files it was never about.
    uploadFile.mockResolvedValue(UPLOADED);
    const groups = holdGroupRequests();

    const { api, provider } = await renderSolution('regular', { multiple: true, groupOutput: true });
    const recorder = recordEvents(provider);
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await expect.poll(() => groups.length).toBe(1);

    // A second file: a different collection, and a different group to make, once the collection observer has seen it.
    api.addFileFromObject(IMAGE.PIXEL);
    await expect.poll(() => recorder.detailsOf('file-added')).toHaveLength(2);
    await expect.poll(() => groups.length).toBe(2);

    // The current group lands after the stale rejection, so once it is created the rejection has been handled too.
    // Creating a group does not re-run the collection validators, so a GROUP_ERROR raised by the rejection would stay.
    groups[0].reject(new Error('too late'));
    groups[1].resolve({ uuid: 'current-group~2', cdnUrl: 'https://ucarecdn.com/current-group~2/' });
    await recorder.waitFor('group-created');

    expect(api.getOutputCollectionState().errors.map((error) => error.type)).not.toContain('GROUP_ERROR');
  });
});

/** Makes every `uploadFileGroup` call wait until the test settles it, in call order. */
function holdGroupRequests() {
  const held: ReturnType<typeof withResolvers<unknown>>[] = [];
  uploadFileGroup.mockImplementation(() => {
    const request = withResolvers<unknown>();
    held.push(request);
    return request.promise;
  });
  return held;
}
