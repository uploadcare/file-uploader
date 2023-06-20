type ConfigType = import('./exported').ConfigType;
type UploadCtxProvider = import('..').UploadCtxProvider;
type Config = import('..').Config;
type FileUploaderInline = import('..').FileUploaderInline;
type FileUploaderRegular = import('..').FileUploaderRegular;
type FileUploaderMinimal = import('..').FileUploaderMinimal;
type DataOutput = import('..').DataOutput;
type CloudEditor = import('..').CloudEditor;

type BaseAttributes = {
  'ctx-name': string;
  hidden: boolean;
};
type ShadowWrapperAttributes = { 'css-src': string };

type CustomEvents<K extends Record<string, unknown>> = { [key in keyof K as `on${key}`]: K[key] };
type CustomElement<
  C extends HTMLElement,
  A extends Record<string, unknown> = {},
  P extends Record<string, unknown> = {},
  E extends Record<string, unknown> = {}
> = Partial<{ ref: MutableRefObject<C> } & A & P & CustomEvents<E>>;

declare namespace JSX {
  interface IntrinsicElements {
    'lr-crop-frame': any;
    'lr-editor-crop-button-control': any;
    'lr-editor-filter-control': any;
    'lr-editor-operation-control': any;
    'lr-editor-image-cropper': any;
    'lr-editor-image-fader': any;
    'lr-editor-scroller': any;
    'lr-editor-slider': any;
    'lr-editor-toolbar': any;
    'lr-lr-btn-ui': any;
    'lr-line-loader-ui': any;
    'lr-presence-toggle': any;
    'lr-slider-ui': any;
    'lr-icon': any;
    'lr-img': any;
    'lr-simple-btn': any;
    'lr-start-from': any;
    'lr-drop-area': any;
    'lr-source-btn': any;
    'lr-source-list': any;
    'lr-file-item': any;
    'lr-modal': any;
    'lr-upload-list': any;
    'lr-url-source': any;
    'lr-camera-source': any;
    'lr-upload-details': any;
    'lr-message-box': any;
    'lr-confirmation-dialog': any;
    'lr-progress-bar-common': any;
    'lr-progress-bar': any;
    'lr-editable-canvas': any;
    'lr-cloud-image-editor': any;
    'lr-external-source': any;
    'lr-tabs': any;
    'lr-cloud-editor': CustomElement<
      CloudEditor,
      BaseAttributes & ShadowWrapperAttributes & { uuid: string; 'cdn-url': string }
    >;
    'lr-data-output': CustomElement<
      DataOutput,
      BaseAttributes,
      {},
      {
        // TODO: Add types for this event
        'lr-data-output': (e: CustomEvent<{ data: any[] | { groupData: Record<string, any>; files: any[] } }>) => void;
      }
    >;
    'lr-file-uploader-regular': CustomElement<FileUploaderRegular, BaseAttributes & ShadowWrapperAttributes>;
    'lr-file-uploader-minimal': CustomElement<FileUploaderMinimal, BaseAttributes & ShadowWrapperAttributes>;
    'lr-file-uploader-inline': CustomElement<FileUploaderInline, BaseAttributes & ShadowWrapperAttributes>;
    'lr-upload-ctx-provider': CustomElement<UploadCtxProvider, BaseAttributes>;
    'lr-config': CustomElement<Config, BaseAttributes, ConfigType>;
  }
}
