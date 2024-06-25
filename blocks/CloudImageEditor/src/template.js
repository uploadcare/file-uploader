import { TRANSPARENT_PIXEL_SRC } from '../../../utils/transparentPixelSrc.js';
import svgIconsSprite from './svg-sprite.js';

export const TEMPLATE = /* HTML */ `
  ${svgIconsSprite}
  <div class="uc-wrapper uc-wrapper_desktop">
    <lr-presence-toggle class="uc-network_problems_splash" set="visible: presence.networkProblems;">
      <div class="uc-network_problems_content">
        <div class="uc-network_problems_icon">
          <lr-icon name="sad"></lr-icon>
        </div>
        <div class="uc-network_problems_text">Network error</div>
      </div>
      <div class="uc-network_problems_footer">
        <lr-btn-ui theme="primary" text="Retry" set="onclick: *on.retryNetwork"></lr-btn-ui>
      </div>
    </lr-presence-toggle>
    <div class="uc-viewport">
      <div class="uc-file_type_outer">
        <div class="uc-file_type">{{fileType}}</div>
      </div>
      <div class="uc-image_container" ref="img-container-el">
        <img src="${TRANSPARENT_PIXEL_SRC}" class="uc-image uc-image_visible_from_editor" ref="img-el" />
        <lr-editor-image-cropper ref="cropper-el"></lr-editor-image-cropper>
        <lr-editor-image-fader ref="fader-el"></lr-editor-image-fader>
      </div>
      <div class="uc-info_pan">{{msg}}</div>
    </div>
    <div class="uc-toolbar">
      <lr-line-loader-ui set="active: showLoader"></lr-line-loader-ui>
      <div class="uc-toolbar_content uc-toolbar_content__editor">
        <lr-editor-toolbar></lr-editor-toolbar>
      </div>
    </div>
  </div>
`;
