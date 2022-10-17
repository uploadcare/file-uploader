import { TRANSPARENT_PIXEL_SRC } from '../../../utils/transparentPixelSrc.js';

export const TEMPLATE = /* HTML */ `
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
        <img src="${TRANSPARENT_PIXEL_SRC}" class="image image_visible_from_editor" ref="img-el" />
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
