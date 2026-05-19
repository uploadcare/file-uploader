/** biome-ignore-all assist/source/organizeImports: Order should be pretty */
import './blocks/themes/uc-basic/index.css';

// Cross-package surface (Lit infra, mixins, contracts, pure utilities)
export * from './internal.js';

// === File-uploader's own public surface (NOT exposed via /internal) ===

// Symbiote.js
export { PubSub as Data, PubSub } from './lit/PubSubCompat';
export { BaseComponent } from './lit/BaseComponent';

// Abstract aliases (file-uploader's public class names)
export { LitBlock as Block } from './lit/LitBlock';
export { LitSolutionBlock as SolutionBlock, LitSolutionBlock } from './lit/LitSolutionBlock';
export { LitUploaderBlock as UploaderBlock } from './lit/LitUploaderBlock';
export { LitActivityBlock as ActivityBlock } from './lit/LitActivityBlock';

// Utils
export { loadFileUploaderFrom } from './abstract/loadFileUploaderFrom';
export { defineLocale } from './abstract/localeRegistry';
export { ModalEvents, type ModalId } from './abstract/managers/ModalManager';
export { toKebabCase } from './utils/toKebabCase';
// Shared blocks
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

// Composed
export { StartFrom } from './blocks/StartFrom/StartFrom';
export { UploadCtxProvider } from './blocks/UploadCtxProvider/UploadCtxProvider';
export { UploadList } from './blocks/UploadList/UploadList';
export { DropArea } from './blocks/DropArea/DropArea';
export { FileItem } from './blocks/FileItem/FileItem';
export { SimpleBtn } from './blocks/SimpleBtn/SimpleBtn';
export { PluginActivityRenderer, PluginActivityHost } from './blocks/PluginActivityRenderer';
export { ExternalUploadSource, UploadSource } from './utils/UploadSource';

// Optional sources
export { UrlSource } from './blocks/UrlSource/UrlSource';
export { ExternalSource } from './blocks/ExternalSource/ExternalSource';
export { CameraSource } from './blocks/CameraSource/CameraSource';

// File-uploader solutions
export { FileUploaderRegular } from './solutions/file-uploader/regular/FileUploaderRegular';
export { FileUploaderInline } from './solutions/file-uploader/inline/FileUploaderInline';
export { FileUploaderMinimal } from './solutions/file-uploader/minimal/FileUploaderMinimal';

// Types
export * from './types/index';
