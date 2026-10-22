import { NetworkError, UploadError } from '@uploadcare/upload-client';
import { assert, describe, expect, it, vi } from 'vitest';
import { withResolvers } from '@/utils/withResolvers';
import { IMAGE } from '~/tests/fixtures/files';
import { emulatorSession, isLive } from '~/tests/utils/emulator.browser';
import { recordEvents } from '~/tests/utils/event-recorder';
import { renderSolution } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * What a failed upload reports: the classification (FileItem's catch plus `validateUploadError`) an integrator
 * branches on, and whether the thrown error survives to `payload.error`. Each failure starts where it would in
 * production: the Upload API refusing the request, the connection dropping, or the integrator's own code throwing.
 *
 * A failing token function (AUTH_TOKEN_ERROR) is `auth-token.e2e`'s, against a project that enforces tokens.
 *
 * The tests that steer the emulator with a scenario are fake-only (`it.skipIf(isLive)`): live there is nothing to
 * steer.
 */

/** Uploads one file and returns the entry's errors once it has some. */
const errorsFor = async (...args: Parameters<typeof renderSolution>) => {
  const { api } = await renderSolution(...args);
  api.addFileFromObject(IMAGE.PIXEL);
  api.uploadAll();

  await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.errors.length).toBeGreaterThan(0);
  return api.getOutputCollectionState().allEntries[0].errors;
};

describe('a failed upload', () => {
  it('reports an Upload API rejection as UPLOAD_ERROR', async () => {
    const [reported] = await errorsFor('regular', {}, { pubkey: 'not-a-project' });

    // Narrowed rather than cast, so the payload is typed as the union member says it is.
    assert(reported.type === 'UPLOAD_ERROR', `expected UPLOAD_ERROR, got ${reported.type}`);
    expect(reported.payload?.error).toBeInstanceOf(UploadError);
    expect(reported.payload?.error.code).toBe('ProjectPublicKeyInvalidError');
    expect(reported.message).toBe(reported.payload?.error.message);
  });

  it.skipIf(isLive)('reports a dead connection as NETWORK_ERROR', async () => {
    emulatorSession().on('POST /base/', () => Response.error());

    const [reported] = await errorsFor('regular', { retryNetworkErrorMaxTimes: 0 });

    assert(reported.type === 'NETWORK_ERROR', `expected NETWORK_ERROR, got ${reported.type}`);
    expect(reported.payload?.error).toBeInstanceOf(NetworkError);
  });

  it('falls back to UNKNOWN_ERROR for anything else', async () => {
    // A `metadata` function is the integrator's code, run inside the upload task, and may throw anything.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cause = new Error('something nobody classified');

    const [reported] = await errorsFor('regular', {
      metadata: () => {
        throw cause;
      },
    });

    assert(reported.type === 'UNKNOWN_ERROR', `expected UNKNOWN_ERROR, got ${reported.type}`);
    expect(reported.payload?.error?.cause).toBe(cause);
  });
});

describe.skipIf(isLive)('a failed group creation', () => {
  it('reports GROUP_ERROR rather than failing silently', async () => {
    // `_createGroup` is deliberately not awaited, so before this the rejection
    // was unhandled and the output simply had no group.
    emulatorSession().on('POST /group/', () =>
      Response.json({ error: { status_code: 400, content: 'Some files not found.' } }),
    );

    const { api } = await renderSolution('regular', {
      multiple: true,
      groupOutput: true,
    });
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    await expect.poll(() => api.getOutputCollectionState().errors.length).toBeGreaterThan(0);
    const [reported] = api.getOutputCollectionState().errors;

    assert(reported.type === 'GROUP_ERROR', `expected GROUP_ERROR, got ${reported.type}`);
    expect(reported.payload?.error).toBeInstanceOf(UploadError);
    expect(reported.message).toBe('Some files not found.');
    expect(api.getOutputCollectionState().group).toBeNull();
  });

  it('ignores a group that arrives for a collection that has since changed', async () => {
    // The success path used to compare `*collectionState`, which is republished
    // on a flush rather than on every change — so a group made from the old
    // file set was published as the collection's group, missing the new file.
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
    groups[0].resolve(undefined);
    groups[1].resolve(undefined);
    await recorder.waitFor('group-created');

    // A group id ends in its file count: the one-file group is the stale one.
    expect(recorder.detailsOf('group-created').map((state) => state.group.uuid)).toEqual([
      expect.stringMatching(/~2$/),
    ]);
  });

  it('ignores a group failure for a collection that has since changed', async () => {
    // The request cannot be cancelled, so a late rejection would otherwise
    // report against files it was never about.
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
    groups[0].resolve(Response.json({ error: { status_code: 400, content: 'too late' } }));
    groups[1].resolve(undefined);
    await recorder.waitFor('group-created');

    expect(api.getOutputCollectionState().errors.map((error) => error.type)).not.toContain('GROUP_ERROR');
  });
});

/**
 * Holds every group creation at the emulator until the test settles it, in arrival order: with a `Response` to answer
 * it with, or `undefined` to let the emulator create the group.
 */
function holdGroupRequests() {
  const held: ReturnType<typeof withResolvers<Response | undefined>>[] = [];
  emulatorSession().on('POST /group/', async ({ next }) => {
    const request = withResolvers<Response | undefined>();
    held.push(request);
    return (await request.promise) ?? next();
  });
  return held;
}
