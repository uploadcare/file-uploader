/** biome-ignore-all assist/source/organizeImports: Order should be pretty */

// Side-effect-free barrel of file-uploader's shared infrastructure.
// Consumed by sibling packages (e.g. @uploadcare/cloud-image-editor) that
// need the lit base classes, managers, utils, and contracts but must NOT
// pull the heavy uc-basic theme that ./index.ts imports.

// Symbiote.js
export { PubSub as Data, PubSub } from './lit/PubSubCompat';
export { BaseComponent } from './lit/BaseComponent';
export { UID } from './utils/UID';

// Utils:
export { defineComponents } from './abstract/defineComponents';
export { loadFileUploaderFrom } from './abstract/loadFileUploaderFrom';
export { defineLocale } from './abstract/localeRegistry';
export { ModalEvents, type ModalId } from './abstract/managers/ModalManager';
export { toKebabCase } from './utils/toKebabCase';

// Abstract:
export { LitBlock as Block, LitBlock } from './lit/LitBlock';
export { LitSolutionBlock as SolutionBlock, LitSolutionBlock } from './lit/LitSolutionBlock';
export { LitUploaderBlock as UploaderBlock, LitUploaderBlock } from './lit/LitUploaderBlock';
export { LitActivityBlock as ActivityBlock, LitActivityBlock } from './lit/LitActivityBlock';

// Shared blocks:
export { Icon } from './blocks/Icon/Icon';
export { Img } from './blocks/Img/Img';
export { Modal } from './blocks/Modal/Modal';
export { FormInput } from './blocks/FormInput/FormInput';
export { Copyright } from './blocks/Copyright/Copyright';
export { ProgressBar } from './blocks/ProgressBar/ProgressBar';
export { ProgressBarCommon } from './blocks/ProgressBarCommon/ProgressBarCommon';
export { Select } from './blocks/Select/Select';
export { SourceBtn } from './blocks/SourceBtn/SourceBtn';
export { SourceList } from './blocks/SourceList/SourceList';
export { Spinner } from './blocks/Spinner/Spinner';
export { Thumb } from './blocks/Thumb/Thumb';
export { ActivityHeader } from './blocks/ActivityHeader/ActivityHeader';

// Composed:
export { StartFrom } from './blocks/StartFrom/StartFrom';
export { UploadCtxProvider } from './blocks/UploadCtxProvider/UploadCtxProvider';
export { UploadList } from './blocks/UploadList/UploadList';
export { Config } from './blocks/Config/Config';
export { DropArea } from './blocks/DropArea/DropArea';
export { FileItem } from './blocks/FileItem/FileItem';
export { SimpleBtn } from './blocks/SimpleBtn/SimpleBtn';
export { PluginActivityRenderer, PluginActivityHost } from './blocks/PluginActivityRenderer';
export { ExternalUploadSource, UploadSource } from './utils/UploadSource';

// Optional sources:
export { CloudImageEditorActivity } from './blocks/CloudImageEditorActivity/CloudImageEditorActivity';
export { UrlSource } from './blocks/UrlSource/UrlSource';
export { ExternalSource } from './blocks/ExternalSource/ExternalSource';
export { CameraSource } from './blocks/CameraSource/CameraSource';

// File-uploader solutions:
export { FileUploaderRegular } from './solutions/file-uploader/regular/FileUploaderRegular';
export { FileUploaderInline } from './solutions/file-uploader/inline/FileUploaderInline';
export { FileUploaderMinimal } from './solutions/file-uploader/minimal/FileUploaderMinimal';

// Cross-package contracts (used by @uploadcare/cloud-image-editor):
export { InternalEventType } from './blocks/UploadCtxProvider/EventEmitter';

// Utils used by sibling packages:
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
export { serializeCsv, deserializeCsv } from './utils/comma-separated';
export { debounce } from './utils/debounce';
export { batchPreloadImages, preloadImage } from './utils/preloadImage';
export { stringToArray } from './utils/stringToArray';
export { throttle } from './utils/throttle';
export { TRANSPARENT_PIXEL_SRC } from './utils/transparentPixelSrc';

// Types:
export * from './types/index';
export type { Uid } from './lit/Uid';
export type { AriaRole } from './types/dom';

// Other:
export * from './env';
