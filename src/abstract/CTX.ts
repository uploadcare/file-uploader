import type { UploadcareGroup } from '@uploadcare/upload-client';
import { Queue } from '@uploadcare/upload-client';
import type { LitBlock } from '../lit/LitBlock';
import type { OutputCollectionState, OutputErrorCollection } from '../types/index';

export const blockCtx = () => ({});

export const activityBlockCtx = (fnCtx: LitBlock) => ({
  ...blockCtx(),
  '*currentActivity': null,
  '*currentActivityParams': {},

  '*history': [],
  '*historyBack': null,
  '*closeModal': () => {
    fnCtx.modalManager?.close(fnCtx.$['*currentActivity']);

    fnCtx.pub('*currentActivity', null);
  },
});

export const uploaderBlockCtx = (fnCtx: LitBlock) => ({
  ...activityBlockCtx(fnCtx),
  '*commonProgress': 0,
  '*uploadList': [],
  '*uploadQueue': new Queue(1),
  '*collectionErrors': [] as OutputErrorCollection[],
  '*collectionState': null as OutputCollectionState | null,
  '*groupInfo': null as UploadcareGroup | null,
  '*uploadTrigger': new Set<string>(),
});

export const solutionBlockCtx = (fnCtx: LitBlock) => ({
  ...uploaderBlockCtx(fnCtx),
  '*solution': null as string | null,
});
