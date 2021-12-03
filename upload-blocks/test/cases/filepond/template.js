export const TPL = /*html*/ `
<uc-drop-area ref="dropArea">
  <uc-start-from activity="source-select">
    <span>Drag & Drop your</span>
    <span>picture or <a 
      class="browse-link"
      set="onclick: selectClicked">Browse</a>
    </span>
  </uc-start-from>
  <uc-upload-list></uc-upload-list>
</uc-drop-area>

<uc-message-box></uc-message-box>
<uc-progress-bar></uc-progress-bar>
`;
