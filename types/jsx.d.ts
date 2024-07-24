/// <reference types="react" />

type ConfigPlainType = import('./exported.js').ConfigPlainType;
type UploadCtxProvider = import('../index.js').UploadCtxProvider;
type Config = import('../index.js').Config;
type FileUploaderInline = import('../index.js').FileUploaderInline;
type FileUploaderRegular = import('../index.js').FileUploaderRegular;
type FileUploaderMinimal = import('../index.js').FileUploaderMinimal;
type FormInput = import('../index.js').FormInput;
type CloudImageEditorBlock = import('../index.js').CloudImageEditorBlock;
type CtxAttributes = {
  'ctx-name': string;
};
type CommonHtmlAttributes<T> = Partial<
  Pick<React.HTMLAttributes<T>, 'id' | 'children' | 'hidden'> & { class: React.HTMLAttributes<T>['className'] }
>;

type CustomElement<C, A = {}> = React.DetailedHTMLProps<CommonHtmlAttributes<C>, C> & A;

declare namespace JSX {
  interface IntrinsicElements {
    'uc-crop-frame': any;
    'uc-editor-crop-button-control': any;
    'uc-editor-filter-control': any;
    'uc-editor-operation-control': any;
    'uc-editor-image-cropper': any;
    'uc-editor-image-fader': any;
    'uc-editor-scroller': any;
    'uc-editor-slider': any;
    'uc-editor-toolbar': any;
    'uc-btn-ui': any;
    'uc-line-loader-ui': any;
    'uc-presence-toggle': any;
    'uc-slider-ui': any;
    'uc-icon': any;
    'uc-img': any;
    'uc-simple-btn': any;
    'uc-start-from': any;
    'uc-drop-area': any;
    'uc-source-btn': any;
    'uc-source-list': any;
    'uc-file-item': any;
    'uc-modal': any;
    'uc-upload-list': any;
    'uc-url-source': any;
    'uc-camera-source': any;
    'uc-progress-bar-common': any;
    'uc-progress-bar': any;
    'uc-external-source': any;
    'uc-cloud-image-editor-activity': any;
    'uc-cloud-image-editor-block': CustomElement<
      CloudImageEditorBlock,
      CtxAttributes & ({ uuid: string } | { 'cdn-url': string }) & Partial<{ tabs: string; 'crop-preset': string }>
    >;
    'uc-cloud-image-editor': CustomElement<CloudImageEditorBlock, JSX.IntrinsicElements['uc-cloud-image-editor-block']>;
    'uc-form-input': CustomElement<FormInput, CtxAttributes>;
    'uc-file-uploader-regular': CustomElement<FileUploaderRegular, CtxAttributes>;
    'uc-file-uploader-minimal': CustomElement<FileUploaderMinimal, CtxAttributes>;
    'uc-file-uploader-inline': CustomElement<FileUploaderInline, CtxAttributes>;
    'uc-upload-ctx-provider': CustomElement<InstanceType<UploadCtxProvider>, CtxAttributes>;
    'uc-config': CustomElement<InstanceType<Config>, CtxAttributes & Partial<ConfigPlainType>>;

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
    'lr-progress-bar-common': any;
    'lr-progress-bar': any;
    'lr-external-source': any;
    'lr-cloud-image-editor-activity': any;
    'lr-cloud-image-editor-block': CustomElement<
      CloudImageEditorBlock,
      CtxAttributes & ({ uuid: string } | { 'cdn-url': string }) & Partial<{ tabs: string; 'crop-preset': string }>
    >;
    'lr-cloud-image-editor': CustomElement<CloudImageEditorBlock, JSX.IntrinsicElements['lr-cloud-image-editor-block']>;
    'lr-form-input': CustomElement<FormInput, CtxAttributes>;
    'lr-file-uploader-regular': CustomElement<FileUploaderRegular, CtxAttributes>;
    'lr-file-uploader-minimal': CustomElement<FileUploaderMinimal, CtxAttributes>;
    'lr-file-uploader-inline': CustomElement<FileUploaderInline, CtxAttributes>;
    'lr-upload-ctx-provider': CustomElement<InstanceType<UploadCtxProvider>, CtxAttributes>;
    'lr-config': CustomElement<InstanceType<Config>, CtxAttributes & Partial<ConfigPlainType>>;
  }
}
