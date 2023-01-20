import { SolutionBlock } from '../../../abstract/SolutionBlock.js';

export class FileUploaderRegular extends SolutionBlock {}

FileUploaderRegular.template = /* HTML */ `
  <lr-simple-btn></lr-simple-btn>

  <lr-modal strokes block-body-scrolling>
    <lr-start-from>
      <lr-drop-area with-icon clickable></lr-drop-area>
      <lr-source-list wrap></lr-source-list>
      <a href="https://uploadcare.com/" target="_blank" class="credits">Powered by Uploadcare</a>
    </lr-start-from>
    <lr-upload-list></lr-upload-list>
    <lr-camera-source></lr-camera-source>
    <lr-url-source></lr-url-source>
    <lr-external-source></lr-external-source>
    <lr-confirmation-dialog></lr-confirmation-dialog>
    <lr-cloud-image-editor></lr-cloud-image-editor>
  </lr-modal>

  <lr-message-box></lr-message-box>
  <lr-progress-bar-common></lr-progress-bar-common>
`;
