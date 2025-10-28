import type { UploadcareGroup } from '@uploadcare/upload-client';
import { Queue } from '@uploadcare/upload-client';
import type { OutputCollectionState, OutputErrorCollection } from '../types/index';
import type { Block } from './Block';
import type { SecureUploadsManager } from './managers/SecureUploadsManager';

export const blockCtx = () => ({});

export const activityBlockCtx = (fnCtx: Block) => ({
  ...blockCtx(),
  '*currentActivity': null,
  '*currentActivityParams': {},

  '*history': [],
  '*historyBack': null,
  '*closeModal': () => {
    fnCtx.modalManager?.close(fnCtx.$['*currentActivity']);

    fnCtx.set$({
      '*currentActivity': null,
    });
  },
});

export const uploaderBlockCtx = (fnCtx: Block) => ({
  ...activityBlockCtx(fnCtx),
  '*commonProgress': 0,
  '*uploadList': [],
  '*uploadQueue': new Queue(1),
  '*collectionErrors': [] as OutputErrorCollection[],
  '*collectionState': null as OutputCollectionState | null,
  '*groupInfo': null as UploadcareGroup | null,
  '*uploadTrigger': new Set<string>(),
  '*secureUploadsManager': null as SecureUploadsManager | null,
});

export const solutionBlockCtx = (fnCtx: Block) => ({
  ...uploaderBlockCtx(fnCtx),
  '*solution': null as string | null,
});
