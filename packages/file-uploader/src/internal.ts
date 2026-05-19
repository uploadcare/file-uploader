/** biome-ignore-all assist/source/organizeImports: Order should be pretty */

// Side-effect-free barrel of file-uploader's shared infrastructure.
//
// Consumed by sibling packages (@uploadcare/adaptive-image,
// @uploadcare/cloud-image-editor) that need the Lit base classes, mixins,
// contracts and pure utilities, but MUST NOT pull file-uploader's
// uploader-specific blocks/solutions or the uc-basic theme CSS.
//
// Anything specific to file-uploader's own public API (Modal, FileItem,
// FileUploaderRegular, sources, etc.) lives in ./index.ts instead so it
// stays out of dist/internal.js -- this keeps adaptive-image's
// web/uc-img.min.js bundle small when tsup follows the internal subpath.

// Lit base classes
export { LitBlock } from './lit/LitBlock';
export { LitActivityBlock } from './lit/LitActivityBlock';
export { LitUploaderBlock } from './lit/LitUploaderBlock';

// Lit mixins (used by adaptive-image's Img + adaptive-image's ImgConfig)
export { CssDataMixin } from './lit/CssDataMixin';
export { RegisterableElementMixin } from './lit/RegisterableElementMixin';
export type { Constructor } from './lit/Constructor';

// Web components needed by sibling solutions (cloud-image-editor's solution
// barrel re-exports these so consumers can defineComponents() them).
export { Config } from './blocks/Config/Config';
export { Icon } from './blocks/Icon/Icon';

// Custom-element registration helper
export { defineComponents } from './abstract/defineComponents';

// Cross-package contracts (used by @uploadcare/cloud-image-editor)
export { EventType, InternalEventType } from './blocks/UploadCtxProvider/EventEmitter';
export { ACTIVITY_TYPES } from './lit/activity-constants';
export type { UploaderPlugin } from './abstract/managers/plugin';
export type { TypedData } from './abstract/TypedData';
export type { UploadEntryData } from './abstract/uploadEntrySchema';
export type { Uid } from './lit/Uid';
export type { AriaRole } from './types/dom';
export type { ConfigType } from './types/exported';

// Pure utilities (used by adaptive-image and/or cloud-image-editor)
export { UID } from './utils/UID';
export {
  createCdnUrl,
  createCdnUrlModifiers,
  createOriginalUrl,
  extractCdnUrlModifiers,
  extractFilename,
  extractOperations,
  extractUuid,
  joinCdnOperations,
} from './utils/cdn-utils';
export { deserializeCsv, serializeCsv } from './utils/comma-separated';
export { debounce } from './utils/debounce';
export { batchPreloadImages, preloadImage } from './utils/preloadImage';
export { stringToArray } from './utils/stringToArray';
export { applyTemplateData } from './utils/template-utils';
export { throttle } from './utils/throttle';
export { TRANSPARENT_PIXEL_SRC } from './utils/transparentPixelSrc';
export { uniqueArray } from './utils/uniqueArray';

// Package env constants (PACKAGE_NAME, PACKAGE_VERSION)
export * from './env';
