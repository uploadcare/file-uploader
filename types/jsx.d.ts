/// <reference types="react" />

type ConfigPlainType = import('./exported').ConfigPlainType;
type UploadCtxProvider = import('..').UploadCtxProvider;
type Config = import('../index.js').Config;
type FileUploaderInline = import('..').FileUploaderInline;
type FileUploaderRegular = import('..').FileUploaderRegular;
type FileUploaderMinimal = import('..').FileUploaderMinimal;
type DataOutput = import('..').DataOutput;
type CloudImageEditorBlock = import('..').CloudImageEditorBlock;
type CtxAttributes = {
  'ctx-name': string;
};
type ShadowWrapperAttributes = { 'css-src': string };
type CommonHtmlAttributes<T> = Partial<
  Pick<React.HTMLAttributes<T>, 'id' | 'children' | 'hidden'> & { class: React.HTMLAttributes<T>['className'] }
>;

type CustomElement<C, A = {}> = React.DetailedHTMLProps<CommonHtmlAttributes<C>, C> & A;

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
    'lr-external-source': any;
    'lr-tabs': any;
    'lr-cloud-image-editor-activity': any;
    'lr-cloud-image-editor-block': CustomElement<
      CloudImageEditorBlock,
      CtxAttributes & { uuid: string; 'cdn-url': string }
    >;
    'lr-cloud-image-editor': CustomElement<
      CloudImageEditorBlock,
      CtxAttributes & ShadowWrapperAttributes & { uuid: string; 'cdn-url': string }
    >;
    'lr-data-output': CustomElement<DataOutput, CtxAttributes>;
    'lr-file-uploader-regular': CustomElement<FileUploaderRegular, CtxAttributes & ShadowWrapperAttributes>;
    'lr-file-uploader-minimal': CustomElement<FileUploaderMinimal, CtxAttributes & ShadowWrapperAttributes>;
    'lr-file-uploader-inline': CustomElement<FileUploaderInline, CtxAttributes & ShadowWrapperAttributes>;
    'lr-upload-ctx-provider': CustomElement<UploadCtxProvider, CtxAttributes>;
    'lr-config': CustomElement<Config, CtxAttributes & Partial<ConfigPlainType>>;
  }
}
