import type { UploadcareGroup } from '@uploadcare/upload-client';
import type { OutputCollectionState, OutputErrorCollection } from '../types/index';
import type { LazyPluginEntry } from './managers/plugin/LazyPluginLoader';

// All seeds below are static values — none derive from an element instance.
// (Audited ahead of the M9n ctx-creation seam: these used to take an unused
// `fnCtx: LitBlock` parameter, kept only so call sites could write
// `uploaderBlockCtx(this)`; dropped so the seam can build the full seed set
// pre-any-element, with no element to pass.)
export const blockCtx = () => ({});

export const activityBlockCtx = () => ({
  ...blockCtx(),
});

export const uploaderBlockCtx = () => ({
  ...activityBlockCtx(),
  '*commonProgress': 0,
  '*uploadList': [],
  '*collectionErrors': [] as OutputErrorCollection[],
  '*collectionState': null as OutputCollectionState | null,
  '*groupInfo': null as UploadcareGroup | null,
  '*uploadTrigger': new Set<string>(),
});

export const solutionBlockCtx = () => ({
  ...uploaderBlockCtx(),
  '*lazyPlugins': null as LazyPluginEntry[] | null,
});
