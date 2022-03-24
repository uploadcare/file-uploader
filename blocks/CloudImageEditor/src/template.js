export const TEMPLATE = /*html*/ `
<div class="wrapper wrapper_desktop">
  <uc-presence-toggle class="network_problems_splash" set="visible: presence.networkProblems;">
    <div class="network_problems_content">
      <div class="network_problems_icon">
        <uc-icon size="20" name="sad"></uc-icon>
      </div>
      <div class="network_problems_text">
        Network error
      </div>
    </div>
    <div class="network_problems_footer">
      <uc-btn-ui theme="primary" text="Retry" set="onclick: *on.retryNetwork"></uc-btn-ui>
    </div>
  </uc-presence-toggle>
  <div class="viewport">
    <div class="file_type_outer">
      <div class="file_type">{{fileType}}</div>
    </div>
    <div class="image_container" ref="img-container-el">
      <img class="image image_visible_from_editor" ref="img-el">
      <uc-editor-image-cropper ref="cropper-el"></uc-editor-image-cropper>
      <uc-editor-image-fader ref="fader-el"></uc-editor-image-fader>
    </div>
    <div class="info_pan">{{msg}}</div>
  </div>
  <div class="toolbar">
    <uc-line-loader-ui set="active: showLoader"></uc-line-loader-ui>
    <div class="toolbar_content toolbar_content__editor">
      <uc-editor-toolbar></uc-editor-toolbar>
    </div>
  </div>
</div>
`;
