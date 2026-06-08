/** biome-ignore-all assist/source/organizeImports: Order should be pretty */
import './blocks/themes/uc-basic/index.css';

// Utils:
export { UID } from './utils/UID';
export { defineComponents } from './abstract/defineComponents';
export { loadFileUploaderFrom } from './abstract/loadFileUploaderFrom';
export { defineLocale } from './abstract/localeRegistry';
export { toKebabCase } from './utils/toKebabCase';

// v2 surface:
export { UploaderController } from './abstract/controllers/UploaderController';
export {
  UploaderEventType,
  type UploaderEventKey,
  type UploaderEventPayload,
  type EventBus,
} from './abstract/EventBus';
export { UploaderRegistry } from './abstract/UploaderRegistry';
export type { UploaderApi } from './abstract/UploaderApi';
export type { ActivityId } from './abstract/activity-ids';
export { uploaderContext } from './abstract/context';
export {
  type ActivityRoute,
  type Edge,
  type EdgeContext,
  type EdgeTarget,
  type NavigateCancel,
  type RouteTable,
  NAVIGATE_CANCEL,
} from './abstract/controllers/RouterController';
export {
  TrayLifecycleController,
  type TrayPhase,
} from './abstract/controllers/TrayLifecycleController';
export type { PluginDefinition } from './abstract/controllers/PluginRegistryController';
export { buildOutputCollectionState, getOutputItem } from './abstract/output-collection-state';

// Shared:
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
export { FileActionButton } from './blocks/FileItem/FileActionButton';
export { SimpleBtn } from './blocks/SimpleBtn/SimpleBtn';
export { SmartBtn } from './blocks/SmartBtn/SmartBtn';
export { NoWrapModeSmartBtn } from './blocks/SmartBtn/NoWrapModeSmartBtn';
export { PrimaryAction } from './blocks/SmartBtn/PrimaryAction';
export { PluginActivityRenderer, PluginActivityHost } from './blocks/PluginActivityRenderer';
export { ExternalUploadSource, UploadSource } from './utils/UploadSource';
export { DropDown } from './blocks/DropDown/DropDown';

// Extract as plugins
export * from './blocks/CloudImageEditor/index';
export { CloudImageEditorActivity } from './blocks/CloudImageEditorActivity/CloudImageEditorActivity';
export { UrlSource } from './blocks/UrlSource/UrlSource';
export { ExternalSource } from './blocks/ExternalSource/ExternalSource';
export { CameraSource } from './blocks/CameraSource/CameraSource';

// v2 plugins — the same set the v1-compat shims auto-install. Available
// here so consumers can opt them in by hand on `<uc-uploader-*>.plugins`.
export { cameraPlugin } from './plugins/cameraPlugin';
export { externalSourcesPlugin } from './plugins/externalSourcesPlugin';
export { imageShrinkPlugin } from './plugins/imageShrinkPlugin';
export { localSourcePlugin } from './plugins/localSourcePlugin';
export { urlSourcePlugin } from './plugins/urlSourcePlugin';
export { cloudImageEditorPlugin } from './plugins/cloudImageEditorPlugin';
export { instagramPlugin } from './plugins/instagramPlugin';

// Solutions (v1-compat shims keep working — `<uc-file-uploader-*>` tags
// register from these and auto-install the default plugin set):
export { FileUploaderRegular } from './solutions/file-uploader/regular/FileUploaderRegular';
export { CloudImageEditor } from './solutions/cloud-image-editor/CloudImageEditor';
export { FileUploaderInline } from './solutions/file-uploader/inline/FileUploaderInline';
export { FileUploaderMinimal } from './solutions/file-uploader/minimal/FileUploaderMinimal';

// v2-native element classes — `<uc-uploader-*>` tags register from
// here without the default-plugin auto-install. Consumers wire
// `plugins` explicitly. The base `Uploader` is the host with the
// controller; preset subclasses pick the layout. `UploaderTray` is
// a v2-only attached-mode preset.
export { Uploader } from './abstract/Uploader';
export { UploaderRegular } from './solutions/file-uploader/regular/UploaderRegular';
export { UploaderMinimal } from './solutions/file-uploader/minimal/UploaderMinimal';
export { UploaderInline } from './solutions/file-uploader/inline/UploaderInline';
export { UploaderTray } from './solutions/file-uploader/tray/UploaderTray';

// Types
export * from './types/index';

// Other
export * from './env';
