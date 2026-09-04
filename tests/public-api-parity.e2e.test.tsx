import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { UploadCtxProvider } from '@/index';
import { ACTIVITY_TYPES } from '@/lit/activity-constants';
import surface from '../specs/public-api/public-surface.json' with { type: 'json' };
import { getCtxName } from './utils/test-renderer';
import '../types/jsx';

/**
 * Asserts the shape of the surface documented in `fern-docs` against a real `getAPI()`. It runs in the browser rather
 * than as a spec because `UploaderPublicApi`'s methods are arrow-function class fields — they exist on instances only,
 * so reading the prototype would prove nothing.
 *
 * The contract itself is transcribed in `specs/public-api/public-surface.json`; see that file's `knownMissing` block
 * for the parts the docs promise and the code does not ship.
 */

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
});

const getApi = () => (page.getByTestId('uc-upload-ctx-provider').query() as UploadCtxProvider).getAPI();

const missingMethods = Object.keys(surface.knownMissing.methods);
const shippedMethods = surface.methods.map((method) => method.name).filter((name) => !missingMethods.includes(name));

describe('documented public API', () => {
  it.each(shippedMethods)('getAPI().%s is callable', (name) => {
    expect(getApi()[name as keyof ReturnType<typeof getApi>]).toBeTypeOf('function');
  });

  it('exposes getCurrentActivity, which api.mdx describes in prose rather than a signature block', () => {
    expect(getApi().getCurrentActivity).toBeTypeOf('function');
  });

  // Methods the released docs promise and the code does not ship. Empty today; an entry here fails the moment the
  // method appears, which is the signal to remove it and let the test above demand it instead. Written as one test
  // rather than `it.each` so it still runs when the list is empty.
  it('does not ship the methods listed in knownMissing', () => {
    const api = getApi();
    for (const name of missingMethods) {
      expect(api[name as keyof typeof api]).toBeUndefined();
    }
  });

  it('accepts every documented activity type that the code registers', () => {
    const missing = Object.keys(surface.knownMissing.activityTypes);
    const registered = Object.values(ACTIVITY_TYPES);
    const documented = ['start-from', 'camera', 'upload-list', 'url', 'cloud-image-edit', 'external', 'details'];

    expect(documented.filter((type) => !registered.includes(type))).toEqual(missing);
  });
});
