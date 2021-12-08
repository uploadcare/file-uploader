export const TPL = /*html*/ `
<uc-drop-area ref="dropArea">
  <button
    class="primary-btn"
    set="onclick: selectClicked;">Select file</button>
</uc-drop-area>

<uc-upload-list hidden></uc-upload-list>

<uc-message-box></uc-message-box>
<uc-progress-bar></uc-progress-bar>

<uc-data-output
  item-template="<img height='200' src='https://ucarecdn.com/{{uuid}}/-/preview/' />">
</uc-data-output>
`;
