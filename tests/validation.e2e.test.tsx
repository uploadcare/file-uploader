import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { CollectionStateController } from '@/abstract/controllers/CollectionStateController';
import '../types/jsx';
import { containerOf, hasCtx } from './utils/registry';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = `test-${Math.random().toString(36).slice(2)}`;
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} testMode pubkey="demopublickey"></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
});

describe('Common upload collection validation', () => {
  describe('multiple', () => {
    // Gap-fill (M9m, ahead of moving ValidationController onto
    // `UploaderController.attachUploaderScope()`): `ValidationController`'s
    // constructor runs `_runAllValidators()` unconditionally, against
    // whatever the collection looks like at that instant — nothing above
    // pins that this ctor-time pass alone (with zero files, no `addFile*`
    // call ever made) already populates `*collectionErrors`. Every other
    // `multipleMin`/`multipleMax` test above sets the config *then* adds
    // file(s), which also exercises the config-subscription rerun path;
    // this one isolates the immediate, construction-time effect.
    it('populates *collectionErrors for an out-of-bounds multipleMin immediately at construction, before any file is added', async () => {
      const ctxName = `test-${Math.random().toString(36).slice(2)}`;
      page.render(
        <>
          <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
          <uc-config
            qualityInsights={false}
            ctx-name={ctxName}
            testMode
            pubkey="demopublickey"
            multipleMin={2}
          ></uc-config>
          <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
        </>,
      );
      await expect.poll(() => hasCtx(ctxName)).toBe(true);
      const collectionState = containerOf(ctxName).get(CollectionStateController);

      await expect.poll(() => collectionState.get('collectionErrors').length).toBeGreaterThan(0);
      const errors = collectionState.get('collectionErrors');
      expect(errors).toContainEqual(expect.objectContaining({ type: 'TOO_FEW_FILES' }));
    });
  });
});
