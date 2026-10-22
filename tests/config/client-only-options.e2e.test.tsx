import type { FileFromOptions } from '@uploadcare/upload-client';
import { describe, expect, it, vi } from 'vitest';
import { IMAGE } from '~/tests/fixtures/files';
import { renderSolution } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * The one documented option that reaches `uploadFile` and nothing past it, so nothing on the wire or in the emulator
 * shows it: the options object is the only place to look, and `uploadFile` stays stubbed for that. Every other option
 * is checked on the requests and the stored files in `upload-client-options.e2e`.
 */

const uploadFile = vi.hoisted(() => vi.fn());

vi.mock('@uploadcare/upload-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uploadcare/upload-client')>();
  return { ...actual, uploadFile };
});

describe('options upload-client does not read', () => {
  it('forwards multipartMaxAttempts, which upload-client ignores', async () => {
    // Never settles: the options are the whole subject, so no made-up upload result follows them.
    uploadFile.mockReturnValue(new Promise(() => {}));
    const { api } = await renderSolution('regular', { multipartMaxAttempts: 5 });
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await vi.waitFor(() => expect(uploadFile).toHaveBeenCalled());

    // QUIRK(config): `multipartMaxAttempts` is documented as "the maximum number of retry attempts for failed
    // multipart upload chunks" and is forwarded to `uploadFile` (`getUploadClientOptions` in LitUploaderBlock.ts), but
    // the option does not exist in @uploadcare/upload-client — the string appears nowhere in the package, and
    // `FileFromOptions` has no such field. It arrives and is ignored, so setting it has no effect at all. The cast is
    // deliberate: the option is genuinely not part of the upload-client type. Pinned as current behaviour, not endorsed.
    const options = uploadFile.mock.calls[0][1] as FileFromOptions & { multipartMaxAttempts?: unknown };
    expect(options.multipartMaxAttempts).toBe(5);
  });
});
