export const ActivityBlock = class {
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const ActivityHeader = class {
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const BaseComponent = class {
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const Block = class {
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const CameraSource = class {
  static template = `
  <lr-activity-header>
    <button type="button" class="mini-btn" set="onclick: *historyBack">
      <lr-icon name="back"></lr-icon>
    </button>
    <div set="@hidden: !cameraSelectHidden">
      <lr-icon name="camera"></lr-icon>
      <span l10n="caption-camera"></span>
    </div>
    <lr-select
      class="camera-select"
      set="$.options: cameraSelectOptions; @hidden: cameraSelectHidden; onchange: onCameraSelectChange"
    >
    </lr-select>
    <button type="button" class="mini-btn close-btn" set="onclick: *closeModal">
      <lr-icon name="close"></lr-icon>
    </button>
  </lr-activity-header>
  <div class="content">
    <video
      autoplay
      playsinline
      set="srcObject: video; style.transform: videoTransformCss; @hidden: videoHidden"
      ref="video"
    ></video>
    <div class="message-box" set="@hidden: messageHidden">
      <span>{{l10nMessage}}</span>
      <span>{{originalErrorMessage}}</span>
      <button
        type="button"
        set="onclick: onRequestPermissions; @hidden: requestBtnHidden"
        l10n="camera-permissions-request"
      ></button>
    </div>
    <button type="button" class="shot-btn" set="onclick: onShot; @disabled: shotBtnDisabled">
      <lr-icon name="camera"></lr-icon>
    </button>
  </div>
`;
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const CloudEditor = class {
  static template = `
  <div class="wrapper wrapper_desktop">
    <lr-presence-toggle class="network_problems_splash" set="visible: presence.networkProblems;">
      <div class="network_problems_content">
        <div class="network_problems_icon">
          <lr-icon size="20" name="sad"></lr-icon>
        </div>
        <div class="network_problems_text">Network error</div>
      </div>
      <div class="network_problems_footer">
        <lr-btn-ui theme="primary" text="Retry" set="onclick: *on.retryNetwork"></lr-btn-ui>
      </div>
    </lr-presence-toggle>
    <div class="viewport">
      <div class="file_type_outer">
        <div class="file_type">{{fileType}}</div>
      </div>
      <div class="image_container" ref="img-container-el">
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" class="image image_visible_from_editor" ref="img-el" />
        <lr-editor-image-cropper ref="cropper-el"></lr-editor-image-cropper>
        <lr-editor-image-fader ref="fader-el"></lr-editor-image-fader>
      </div>
      <div class="info_pan">{{msg}}</div>
    </div>
    <div class="toolbar">
      <lr-line-loader-ui set="active: showLoader"></lr-line-loader-ui>
      <div class="toolbar_content toolbar_content__editor">
        <lr-editor-toolbar></lr-editor-toolbar>
      </div>
    </div>
  </div>
`;
  static observedAttributes = ['uuid', 'cdn-url'];
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const CloudImageEditor = class {
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const ConfirmationDialog = class {
  static template = `
  <lr-activity-header>
    <button type="button" class="mini-btn" set="onclick: *historyBack">
      <lr-icon name="back"></lr-icon>
    </button>
    <span>{{activityCaption}}</span>
    <button type="button" class="mini-btn close-btn" set="onclick: *closeModal">
      <lr-icon name="close"></lr-icon>
    </button>
  </lr-activity-header>

  <div class="message">{{messageTxt}}</div>
  <div class="toolbar">
    <button type="button" class="deny-btn secondary-btn" set="onclick: onDeny">{{denyBtnTxt}}</button>
    <button type="button" class="confirm-btn primary-btn" set="onclick: onConfirm">{{confirmBtnTxt}}</button>
  </div>
`;
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const Copyright = class {
  static template = `
    <a
      href="https://uploadcare.com/?utm_source=copyright&utm_medium=referral&utm_campaign=v4"
      target="_blank noopener"
      class="credits"
      set="@hidden: removeCopyright"
      >Powered by Uploadcare</a
    >
  `;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const CropFrame = class {
  static template = ` <svg class="svg" ref="svg-el" xmlns="http://www.w3.org/2000/svg"></svg> `;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const Data = class {
  static warn = () => {};
  static registerCtx = () => {};
  static deleteCtx = () => {};
  static getCtx = () => {};
  static globalStore = {};
  static apply = () => {};
  static bind = () => {};
  static call = () => {};
  static toString = () => {};
  static hasOwnProperty = () => {};
  static isPrototypeOf = () => {};
  static propertyIsEnumerable = () => {};
  static valueOf = () => {};
  static toLocaleString = () => {};
};
export const DataOutput = class {
  static dict = {
    SRC_CTX_KEY: '*outputData',
    EVENT_NAME: 'lr-data-output',
    FIRE_EVENT_ATTR: 'use-event',
    CONSOLE_ATTR: 'use-console',
    GROUP_ATTR: 'use-group',
    FORM_INPUT_ATTR: 'use-input',
    INPUT_NAME_ATTR: 'input-name',
    INPUT_REQUIRED: 'input-required',
  };
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const DropArea = class {
  static template = `
  <slot>
    <div data-default-slot hidden></div>
    <div ref="content-wrapper" class="content-wrapper" set="@hidden: isHidden">
      <div class="icon-container" set="@hidden: !withIcon">
        <lr-icon name="default"></lr-icon>
        <lr-icon name="arrow-down"></lr-icon>
      </div>
      <span class="text">{{text}}</span>
    </div>
  </slot>
`;
  static observedAttributes = ['with-icon', 'clickable', 'text', 'fullscreen', 'disabled'];
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const EditorCropButtonControl = class {
  static template = `
  <div class="before"></div>
  <lr-icon size="20" set="@name: icon;"></lr-icon>
  <div class="title" ref="title-el">{{title}}</div>
`;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const EditorFilterControl = class {
  static template = `
  <div class="before"></div>
  <lr-icon size="20" set="@name: icon;"></lr-icon>
  <div class="title" ref="title-el">{{title}}</div>
`;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const EditorImageCropper = class {
  static template = `
  <canvas class="canvas" ref="canvas-el"></canvas>
  <lr-crop-frame ref="frame-el"></lr-crop-frame>
`;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const EditorImageFader = class {
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const EditorOperationControl = class {
  static template = `
  <div class="before"></div>
  <lr-icon size="20" set="@name: icon;"></lr-icon>
  <div class="title" ref="title-el">{{title}}</div>
`;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const EditorScroller = class {
  static template = ` <slot></slot> `;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const EditorSlider = class {
  static template = `
  <lr-slider-ui
    ref="slider-el"
    set="disabled: disabled; min: min; max: max; defaultValue: defaultValue; zero: zero; onInput: on.input;"
  ></lr-slider-ui>
`;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const EditorToolbar = class {
  static template = `
  <lr-line-loader-ui set="active: showLoader"></lr-line-loader-ui>
  <div class="info-tooltip_container">
    <div class="info-tooltip_wrapper">
      <div ref="tooltip-el" class="info-tooltip info-tooltip_hidden">{{*operationTooltip}}</div>
    </div>
  </div>
  <div class="toolbar-container">
    <lr-presence-toggle class="sub-toolbar" set="visible: presence.mainToolbar; styles: presence.subTopToolbarStyles">
      <div class="tab-content-row">
    <lr-presence-toggle class="tab-content" set="visible: presence.tabContent.crop; styles: presence.tabContentStyles">
      <lr-editor-scroller hidden-scrollbar>
        <div class="controls-list_align">
          <div class="controls-list_inner" ref="controls-list-crop"></div>
        </div>
      </lr-editor-scroller>
    </lr-presence-toggle>
  
    <lr-presence-toggle class="tab-content" set="visible: presence.tabContent.sliders; styles: presence.tabContentStyles">
      <lr-editor-scroller hidden-scrollbar>
        <div class="controls-list_align">
          <div class="controls-list_inner" ref="controls-list-sliders"></div>
        </div>
      </lr-editor-scroller>
    </lr-presence-toggle>
  
    <lr-presence-toggle class="tab-content" set="visible: presence.tabContent.filters; styles: presence.tabContentStyles">
      <lr-editor-scroller hidden-scrollbar>
        <div class="controls-list_align">
          <div class="controls-list_inner" ref="controls-list-filters"></div>
        </div>
      </lr-editor-scroller>
    </lr-presence-toggle>
  </div>
      <div class="controls-row">
        <lr-btn-ui theme="boring" icon="closeMax" set="onclick: on.cancel"> </lr-btn-ui>
        <div class="tab-toggles">
          <div ref="tabs-indicator" class="tab-toggles_indicator"></div>
          
    <lr-btn-ui
      theme="boring"
      ref="tab-toggle-crop"
      data-id="crop"
      icon="crop"
      tabindex="0"
      set="onclick: on.clickTab;"
    >
    </lr-btn-ui>
  
    <lr-btn-ui
      theme="boring"
      ref="tab-toggle-sliders"
      data-id="sliders"
      icon="sliders"
      tabindex="0"
      set="onclick: on.clickTab;"
    >
    </lr-btn-ui>
  
    <lr-btn-ui
      theme="boring"
      ref="tab-toggle-filters"
      data-id="filters"
      icon="filters"
      tabindex="0"
      set="onclick: on.clickTab;"
    >
    </lr-btn-ui>
  
        </div>
        <lr-btn-ui theme="primary" icon="done" set="onclick: on.apply"> </lr-btn-ui>
      </div>
    </lr-presence-toggle>
    <lr-presence-toggle class="sub-toolbar" set="visible: presence.subToolbar; styles: presence.subBottomToolbarStyles">
      <div class="slider">
        <lr-editor-slider ref="slider-el"></lr-editor-slider>
      </div>
      <div class="controls-row">
        <lr-btn-ui theme="boring" set="@text: l10n.cancel; onclick: on.cancelSlider;"> </lr-btn-ui>
        <lr-btn-ui theme="primary" set="@text: l10n.apply; onclick: on.applySlider;"> </lr-btn-ui>
      </div>
    </lr-presence-toggle>
  </div>
`;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const ExternalSource = class {
  static template = `
  <lr-activity-header>
    <button type="button" class="mini-btn" set="onclick: *historyBack">
      <lr-icon name="back"></lr-icon>
    </button>
    <div>
      <lr-icon set="@name: activityIcon"></lr-icon>
      <span>{{activityCaption}}</span>
    </div>
    <button type="button" class="mini-btn close-btn" set="onclick: *historyBack">
      <lr-icon name="close"></lr-icon>
    </button>
  </lr-activity-header>
  <div class="content">
    <div ref="iframeWrapper" class="iframe-wrapper"></div>
    <div class="toolbar">
      <button type="button" class="cancel-btn secondary-btn" set="onclick: onCancel" l10n="cancel"></button>
      <div></div>
      <div class="selected-counter"><span l10n="selected-count"></span>{{counter}}</div>
      <button type="button" class="done-btn primary-btn" set="onclick: onDone; @disabled: !counter">
        <lr-icon name="check"></lr-icon>
      </button>
    </div>
  </div>
`;
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const FileItem = class {
  static template = `
  <div class="inner" set="@finished: isFinished; @uploading: isUploading; @failed: isFailed; @focused: isFocused">
    <div class="thumb" set="style.backgroundImage: thumbUrl">
      <div class="badge">
        <lr-icon set="@name: badgeIcon"></lr-icon>
      </div>
    </div>
    <div class="file-name-wrapper">
      <span class="file-name" set="@title: itemName">{{itemName}}</span>
      <span class="file-error" set="@hidden: !errorText">{{errorText}}</span>
    </div>
    <div class="file-actions">
      <button type="button" class="edit-btn mini-btn" set="onclick: onEdit; @hidden: !isEditable">
        <lr-icon name="edit-file"></lr-icon>
      </button>
      <button type="button" class="remove-btn mini-btn" set="onclick: onRemove;">
        <lr-icon name="remove-file"></lr-icon>
      </button>
      <button type="button" class="upload-btn mini-btn" set="onclick: onUpload;">
        <lr-icon name="upload"></lr-icon>
      </button>
    </div>
    <lr-progress-bar
      class="progress-bar"
      set="value: progressValue; visible: progressVisible; unknown: progressUnknown"
    >
    </lr-progress-bar>
  </div>
`;
  static activeInstances = {};
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const FilePreview = class {
  static template = ` <lr-img class="img-view" ref="img" set="@src: src; style.aa: src;" /> `;
  static observedAttributes = ['checkerboard'];
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const FileUploaderInline = class {
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const FileUploaderMinimal = class {
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const FileUploaderRegular = class {
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const Icon = class {
  static template = `
  <svg ref="svg" xmlns="http://www.w3.org/2000/svg" set="@viewBox: viewBox; @height: size; @width: size"></svg>
`;
  static observedAttributes = ['name', 'size'];
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const Img = class {
  static observedAttributes = [
    'dev-mode',
    'pubkey',
    'uuid',
    'src',
    'lazy',
    'intersection',
    'breakpoints',
    'cdn-cname',
    'proxy-cname',
    'secure-delivery-proxy',
    'hi-res-support',
    'ultra-res-support',
    'format',
    'cdn-operations',
    'progressive',
    'quality',
    'is-background-for',
  ];
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const LineLoaderUi = class {
  static template = `
  <div class="inner">
    <div class="line" ref="line-el"></div>
  </div>
`;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const LrBtnUi = class {
  static observedAttributes = ['text', 'icon', 'reverse', 'theme'];
  static template = `
  <lr-icon size="20" set="className: iconCss; @name: icon;"></lr-icon>
  <div class="text">{{text}}</div>
`;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const MessageBox = class {
  static template = `
  <div class="heading">
    <lr-icon set="@name: iconName"></lr-icon>
    <div class="caption">{{captionTxt}}</div>
    <button type="button" set="onclick: onClose">
      <lr-icon name="close"></lr-icon>
    </button>
  </div>
  <div class="msg">{{msgTxt}}</div>
`;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const Modal = class {
  static StateConsumerScope = `modal`;
  static template = `
  <dialog ref="dialog">
    <slot></slot>
  </dialog>
`;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const PACKAGE_NAME = `blocks`;
export const PACKAGE_VERSION = `0.21.1`;
export const PresenceToggle = class {
  static template = ` <slot></slot> `;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const ProgressBar = class {
  static template = ` <div ref="line" class="progress"></div> `;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const ProgressBarCommon = class {
  static template = `
  <lr-progress-bar set="visible: visible; unknown: unknown; value: value"></lr-progress-bar>
`;
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const Select = class {
  static template = `
  <button>
    {{currentText}}
    <lr-icon name="select"></lr-icon>
    <select ref="select" set="innerHTML: selectHtml; onchange: onSelect"></select>
  </button>
`;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const ShadowWrapper = class {
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const SimpleBtn = class {
  static template = `
  <lr-drop-area>
    <button type="button" set="onclick: onClick">
      <lr-icon name="upload"></lr-icon>
      <span>{{*simpleButtonText}}</span>
      <slot></slot>
      <div class="visual-drop-area"></div>
    </button>
  </lr-drop-area>
`;
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const SliderUi = class {
  static template = `
  <div class="steps" ref="steps-el"></div>
  <div ref="thumb-el" class="thumb"></div>
  <input
    class="input"
    type="range"
    ref="input-el"
    tabindex="0"
    set="oninput: on.sliderInput; onchange: on.sliderChange; @min: min; @max: max; @value: defaultValue;"
  />
`;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const SourceBtn = class {
  static template = `
  <lr-icon set="@name: iconName"></lr-icon>
  <div class="txt" l10n="src-type"></div>
`;
  static observedAttributes = ['type'];
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const SourceList = class {
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const StartFrom = class {
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const Tabs = class {
  static observedAttributes = ['tab-list', 'default'];
  static template = `
  <div ref="row" class="tabs-row"></div>
  <div ref="context" class="tabs-context">
    <slot></slot>
  </div>
`;
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const UploadCtxProvider = class {
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const UploadDetails = class {
  static template = `
  <lr-activity-header>
    <button type="button" class="mini-btn" set="onclick: *historyBack">
      <lr-icon name="back"></lr-icon>
    </button>
    <span l10n="caption-edit-file"></span>
    <button type="button" class="mini-btn close-btn" set="onclick: *closeModal">
      <lr-icon name="close"></lr-icon>
    </button>
  </lr-activity-header>
  <div class="content">
    <lr-tabs tab-list="tab-view, tab-details">
      <div tab-ctx="tab-details" class="details">
        <div class="info-block">
          <div class="info-block_name" l10n="file-name"></div>
          <input
            name="name-input"
            ref="file_name_input"
            set="value: fileName; oninput: onNameInput; @disabled: !!cdnUrl"
            type="text"
          />
        </div>

        <div class="info-block">
          <div class="info-block_name" l10n="file-size"></div>
          <div>{{fileSize}}</div>
        </div>

        <div class="info-block">
          <div class="info-block_name" l10n="cdn-url"></div>
          <a class="cdn-link" target="_blank" set="@href: cdnUrl; @disabled: !cdnUrl">{{cdnUrl}}</a>
        </div>

        <div>{{errorTxt}}</div>
      </div>

      <lr-file-preview tab-ctx="tab-view" set="@checkerboard: checkerboard;" ref="filePreview"> </lr-file-preview>
    </lr-tabs>

    <div class="toolbar" set="@edit-disabled: cloudEditBtnHidden">
      <button type="button" class="edit-btn secondary-btn" set="onclick: onCloudEdit; @hidden: cloudEditBtnHidden;">
        <lr-icon name="edit"></lr-icon>
        <span l10n="edit-image"></span>
      </button>
      <button type="button" class="remove-btn secondary-btn" set="onclick: onRemove">
        <lr-icon name="remove"></lr-icon>
        <span l10n="remove-from-list"></span>
      </button>
      <div></div>
      <button type="button" class="back-btn primary-btn" set="onclick: onBack">
        <span l10n="ok"></span>
      </button>
    </div>
  </div>
`;
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const UploadList = class {
  static template = `
  <lr-activity-header>
    <span class="header-text">{{headerText}}</span>
    <button type="button" class="mini-btn close-btn" set="onclick: *closeModal">
      <lr-icon name="close"></lr-icon>
    </button>
  </lr-activity-header>

  <div class="no-files" set="@hidden: hasFiles">
    <slot name="empty"><span l10n="no-files"></span></slot>
  </div>

  <div class="files" repeat="*uploadList" repeat-item-tag="lr-file-item"></div>

  <div class="toolbar">
    <button type="button" class="cancel-btn secondary-btn" set="onclick: onCancel;" l10n="clear"></button>
    <div class="toolbar-spacer"></div>
    <button
      type="button"
      class="add-more-btn secondary-btn"
      set="onclick: onAdd; @disabled: !addMoreBtnEnabled; @hidden: !addMoreBtnVisible"
    >
      <lr-icon name="add"></lr-icon><span l10n="add-more"></span>
    </button>
    <button
      type="button"
      class="upload-btn primary-btn"
      set="@hidden: !uploadBtnVisible; onclick: onUpload;"
      l10n="upload"
    ></button>
    <button
      type="button"
      class="done-btn primary-btn"
      set="@hidden: !doneBtnVisible; onclick: onDone;  @disabled: !doneBtnEnabled"
      l10n="done"
    ></button>
  </div>

  <lr-drop-area ghost></lr-drop-area>
`;
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const UploaderBlock = class {
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const UrlSource = class {
  static template = `
  <lr-activity-header>
    <button type="button" class="mini-btn" set="onclick: *historyBack">
      <lr-icon name="back"></lr-icon>
    </button>
    <div>
      <lr-icon name="url"></lr-icon>
      <span l10n="caption-from-url"></span>
    </div>
    <button type="button" class="mini-btn close-btn" set="onclick: *closeModal">
      <lr-icon name="close"></lr-icon>
    </button>
  </lr-activity-header>
  <div class="content">
    <input placeholder="https://" class="url-input" type="text" ref="input" set="oninput: onInput" />
    <button
      type="button"
      class="url-upload-btn primary-btn"
      set="onclick: onUpload; @disabled: importDisabled"
    ></button>
  </div>
`;
  static extSrcList = {
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static sourceTypes = {
    LOCAL: 'local',
    URL: 'url',
    CAMERA: 'camera',
    DRAW: 'draw',
    FACEBOOK: 'facebook',
    DROPBOX: 'dropbox',
    GDRIVE: 'gdrive',
    GPHOTOS: 'gphotos',
    INSTAGRAM: 'instagram',
    FLICKR: 'flickr',
    VK: 'vk',
    EVERNOTE: 'evernote',
    BOX: 'box',
    ONEDRIVE: 'onedrive',
    HUDDLE: 'huddle',
  };
  static activities = {
    START_FROM: 'start-from',
    CAMERA: 'camera',
    DRAW: 'draw',
    UPLOAD_LIST: 'upload-list',
    URL: 'url',
    CONFIRMATION: 'confirmation',
    CLOUD_IMG_EDIT: 'cloud-image-edit',
    EXTERNAL: 'external',
    DETAILS: 'details',
  };
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const Video = class {
  static template = `
  <div class="video-wrapper">
    <video ref="video" preload="metadata" crossorigin="anonymous"></video>
  </div>

  <div class="toolbar">
    <div class="progress" ref="progress" set -onclick="progressClicked">
      <div class="bar" set -style.width="progressCssWidth"></div>
    </div>

    <div class="tb-block">
      <button set -onclick="onPP">
        <lr-icon set -@name="ppIcon"></lr-icon>
      </button>
      <div class="timer">{{currentTime}} / {{totalTime}}</div>
    </div>

    <div class="tb-block">
      <button set -onclick="onCap" -@hidden="!hasSubtitles">
        <lr-icon set -@name="capIcon"></lr-icon>
      </button>

      <button set -onclick="onMute">
        <lr-icon set -@name="volIcon"></lr-icon>
      </button>

      <lr-range type="range" set -onchange="onVolChange" -@disabled="volumeDisabled" -value="volumeValue"> </lr-range>

      <button set -onclick="onFs">
        <lr-icon set -@name="fsIcon"></lr-icon>
      </button>
    </div>
  </div>
`;
  static observedAttributes = ['video', 'src'];
  static reg = () => {};
  static is = `sym-1`;
  static bindAttributes = () => {};
};
export const connectBlocksFrom = () => {};
export const registerBlocks = () => {};
