import { toDslString } from '../../symbiote/core/render_utils.js';
import { ucIconHtml } from './icons/ucIconHtml.js';
import { UcBtnUi } from './elements/button/UcBtnUi.js';
import { LineLoaderUi } from './elements/line-loader/LineLoaderUi.js';
import { PresenceToggle } from './elements/presence-toggle/PresenceToggle.js';
import { EditorImageCropper } from './EditorImageCropper.js';
import { EditorImageFader } from './EditorImageFader.js';
import { EditorToolbar } from './EditorToolbar.js';

export const TEMPLATE = /*html*/ `
    <div css set="css: css.wrapper">
      <${PresenceToggle.is} css="network_problems_splash" set="visible: presence.networkProblems;">
         <div css="network_problems_content">
          <div css="network_problems_icon">
            ${ucIconHtml('sad')}
          </div>
          <div css="network_problems_text">
            Network error
          </div>
         </div>
         <div css="network_problems_footer">
            <${UcBtnUi.is} theme="primary" text="Retry" set="ariaClick: on.retryNetwork"></${UcBtnUi.is}>
         </div>
      </${PresenceToggle.is}>
      <div css="viewport">
        <div css="file_type_outer">
          <div css="file_type" set="textContent: fileType"></div>
        </div>
        <div css="image_container" ref="img-container-el">
          <img css ref="img-el" set="css: css.image;">
          <${EditorImageCropper.is} ref="cropper-el" set="dataCtxProvider: editorToolbarEl"></${EditorImageCropper.is}>
          <${EditorImageFader.is} ref="fader-el" set="dataCtxProvider: editorToolbarEl"></${EditorImageFader.is}>
        </div>
        <div css="info_pan" set="textContent: msg"></div>
      </div>
      <div css="toolbar">
        <${LineLoaderUi.is} set="active: showLoader"></${LineLoaderUi.is}>
        <div css="toolbar_content toolbar_content__editor">
            <${EditorToolbar.is}
              ref="editor-toolbar-el"
              set="${toDslString({
                dataCtxProvider: 'ctxProvider',
                imgContainerEl: 'imgContainerEl',
                faderEl: 'faderEl',
                cropperEl: 'cropperEl',
              })}"></${EditorToolbar.is}>
          </div>
        </div>
      </div>
    </div>
`;
