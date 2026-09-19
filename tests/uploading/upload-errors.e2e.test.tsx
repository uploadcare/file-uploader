import { AuthTokenResolverError, NetworkError, UploadError } from '@uploadcare/upload-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('@uploadcare/upload-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uploadcare/upload-client')>();
  return { ...actual, uploadFile };
});

beforeEach(() => {
  uploadFile.mockReset();
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
    const error = new UploadError('Expired token.', 'TokenExpiredError');

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
