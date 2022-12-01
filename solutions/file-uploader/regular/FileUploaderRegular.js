import { SolutionBlock } from '../../../abstract/SolutionBlock.js';

export class FileUploaderRegular extends SolutionBlock {}

FileUploaderRegular.template = /* HTML */ `
  <lr-simple-btn></lr-simple-btn>

  <lr-modal strokes block-body-scrolling>
    <lr-activity-icon slot="heading"></lr-activity-icon>
    <lr-activity-caption slot="heading"></lr-activity-caption>
    <lr-start-from>
      <lr-drop-area big-icon clickable></lr-drop-area>
      <lr-source-list wrap></lr-source-list>
    </lr-start-from>
    <lr-upload-list></lr-upload-list>
    <lr-camera-source></lr-camera-source>
    <lr-url-source></lr-url-source>
    <lr-external-source></lr-external-source>
    <lr-upload-details></lr-upload-details>
    <lr-confirmation-dialog></lr-confirmation-dialog>
    <lr-cloud-image-editor></lr-cloud-image-editor>
  </lr-modal>

  <lr-message-box></lr-message-box>
  <lr-progress-bar-common></lr-progress-bar-common>
`;
