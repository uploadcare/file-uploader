/// <reference types="react" />

type LitElement = import('lit').LitElement;
type UploadCtxProvider = import('../dist/index.ts').UploadCtxProvider;
type Config = import('../dist/index.ts').Config;
type FileUploaderInline = import('../dist/index.ts').FileUploaderInline;
type FileUploaderRegular = import('../dist/index.ts').FileUploaderRegular;
type FileUploaderMinimal = import('../dist/index.ts').FileUploaderMinimal;
type BtnUi = import('../dist/index.ts').BtnUi;
type LineLoaderUi = import('../dist/index.ts').LineLoaderUi;
type PresenceToggle = import('../dist/index.ts').PresenceToggle;
type SliderUi = import('../dist/index.ts').SliderUi;
type CropFrame = import('../dist/index.ts').CropFrame;
type EditorCropButtonControl = import('../dist/index.ts').EditorCropButtonControl;
type EditorAspectRatioButtonControl = import('../dist/index.ts').EditorAspectRatioButtonControl;
type EditorFreeformButtonControl = import('../dist/index.ts').EditorFreeformButtonControl;
type EditorFilterControl = import('../dist/index.ts').EditorFilterControl;
type EditorOperationControl = import('../dist/index.ts').EditorOperationControl;
type EditorImageCropper = import('../dist/index.ts').EditorImageCropper;
type EditorImageFader = import('../dist/index.ts').EditorImageFader;
type EditorScroller = import('../dist/index.ts').EditorScroller;
type EditorSlider = import('../dist/index.ts').EditorSlider;
type EditorToolbar = import('../dist/index.ts').EditorToolbar;
type Icon = import('../dist/index.ts').Icon;
type Img = import('../dist/index.ts').Img;
type SimpleBtn = import('../dist/index.ts').SimpleBtn;
type StartFrom = import('../dist/index.ts').StartFrom;
type DropArea = import('../dist/index.ts').DropArea;
type SourceBtn = import('../dist/index.ts').SourceBtn;
type SourceList = import('../dist/index.ts').SourceList;
type FileItem = import('../dist/index.ts').FileItem;
type Modal = import('../dist/index.ts').Modal;
type UploadList = import('../dist/index.ts').UploadList;
type UrlSource = import('../dist/index.ts').UrlSource;
type CameraSource = import('../dist/index.ts').CameraSource;
type ProgressBarCommon = import('../dist/index.ts').ProgressBarCommon;
type ProgressBar = import('../dist/index.ts').ProgressBar;
type ExternalSource = import('../dist/index.ts').ExternalSource;
type CloudImageEditorActivity = import('../dist/index.ts').CloudImageEditorActivity;
type FormInput = import('../dist/index.ts').FormInput;
type CloudImageEditorBlock = import('../dist/index.ts').CloudImageEditorBlock;

type CommonHtmlAttributes<T> = Partial<
  Pick<React.HTMLAttributes<T>, 'id' | 'children' | 'hidden'> & { class: React.HTMLAttributes<T>['className'] }
>;

type ReflectAttributes<T extends LitElement & { attributesMeta?: Record<string, unknown> }> = T['attributesMeta'];

type CustomElement<C extends LitElement> = React.DetailedHTMLProps<CommonHtmlAttributes<C>, C> & ReflectAttributes<C>;

declare namespace JSX {
  interface IntrinsicElements {
    'uc-crop-frame': CustomElement<CropFrame>;
    'uc-editor-crop-button-control': CustomElement<EditorCropButtonControl>;
    'uc-editor-aspect-ratio-button-control': CustomElement<EditorAspectRatioButtonControl>;
    'uc-editor-freeform-button-control': CustomElement<EditorFreeformButtonControl>;
    'uc-editor-filter-control': CustomElement<EditorFilterControl>;
    'uc-editor-operation-control': CustomElement<EditorOperationControl>;
    'uc-editor-image-cropper': CustomElement<EditorImageCropper>;
    'uc-editor-image-fader': CustomElement<EditorImageFader>;
    'uc-editor-scroller': CustomElement<EditorScroller>;
    'uc-editor-slider': CustomElement<EditorSlider>;
    'uc-editor-toolbar': CustomElement<EditorToolbar>;
    'uc-btn-ui': CustomElement<BtnUi>;
    'uc-line-loader-ui': CustomElement<LineLoaderUi>;
    'uc-presence-toggle': CustomElement<PresenceToggle>;
    'uc-slider-ui': CustomElement<SliderUi>;
    'uc-icon': CustomElement<Icon>;
    'uc-img': CustomElement<Img> & React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
    'uc-simple-btn': CustomElement<SimpleBtn>;
    'uc-start-from': CustomElement<StartFrom>;
    'uc-drop-area': CustomElement<DropArea>;
    'uc-source-btn': CustomElement<SourceBtn>;
    'uc-source-list': CustomElement<SourceList>;
    'uc-file-item': CustomElement<FileItem>;
    'uc-modal': CustomElement<Modal>;
    'uc-upload-list': CustomElement<UploadList>;
    'uc-url-source': CustomElement<UrlSource>;
    'uc-camera-source': CustomElement<CameraSource>;
    'uc-progress-bar-common': CustomElement<ProgressBarCommon>;
    'uc-progress-bar': CustomElement<ProgressBar>;
    'uc-external-source': CustomElement<ExternalSource>;
    'uc-cloud-image-editor-activity': CustomElement<CloudImageEditorActivity>;
    'uc-cloud-image-editor-block': CustomElement<CloudImageEditorBlock>;
    'uc-cloud-image-editor': CustomElement<CloudImageEditorBlock>;
    'uc-form-input': CustomElement<FormInput>;
    'uc-file-uploader-regular': CustomElement<FileUploaderRegular>;
    'uc-file-uploader-minimal': CustomElement<FileUploaderMinimal>;
    'uc-file-uploader-inline': CustomElement<FileUploaderInline>;
    'uc-upload-ctx-provider': CustomElement<UploadCtxProvider>;
    'uc-config': CustomElement<Config>;
  }
}
