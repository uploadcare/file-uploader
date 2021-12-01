export const TPL = /*html*/ `
<div class="activity-heading">
  <uc-icon set="name: *modalIcon"></uc-icon>
  <div 
    class="activity-heading_text"
    set="textContent: *modalCaption">
  </div>
</div>

<uc-activity-wrapper activity="source-select">
  <uc-drop-area>
    <uc-source-list wrap></uc-source-list>
  </uc-drop-area>
</uc-activity-wrapper>

<uc-upload-list></uc-upload-list>
<uc-camera-source></uc-camera-source>
<uc-url-source></uc-url-source>
<uc-external-source></uc-external-source>
<uc-upload-details></uc-upload-details>
<uc-confirmation-dialog></uc-confirmation-dialog>

<uc-message-box></uc-message-box>
<uc-progress-bar></uc-progress-bar>

<uc-data-output
  fire-event
  from="*outputData"
  item-template="<img height='200' src='https://ucarecdn.com/{{uuid}}/-/preview/' />">
</uc-data-output>

<button set="onclick: cancelClicked; hidden: canceBtnHidden">Cancel</button>
`;
