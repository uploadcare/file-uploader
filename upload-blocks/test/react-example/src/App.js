import '@uploadcare/upload-blocks/build/uc-basic.css';
import '@uploadcare/upload-blocks';
import style from './App.module.css';

function App() {
  const ucClass = `uc-wgt-common ${style.ucConfig}`;
  return (
    <div>
      <uc-simple-btn class={ucClass}></uc-simple-btn>

      <uc-modal class={ucClass} strokes>
        <uc-source-select>
          <uc-source-list wrap></uc-source-list>
          <uc-drop-area></uc-drop-area>
        </uc-source-select>
        <uc-upload-list></uc-upload-list>
        <uc-camera-source></uc-camera-source>
        <uc-url-source></uc-url-source>
        <uc-external-source></uc-external-source>
        <uc-upload-details></uc-upload-details>
        <uc-confirmation-dialog></uc-confirmation-dialog>
        <uc-cloud-image-editor></uc-cloud-image-editor>
      </uc-modal>

      <uc-message-box class={ucClass}></uc-message-box>
      <uc-progress-bar class={ucClass}></uc-progress-bar>

      <uc-data-output
        fire-event
        from="*outputData"
        item-template="<img height='200' src='https://ucarecdn.com/{{uuid}}/-/preview/' />"
        class={ucClass}
      ></uc-data-output>
    </div>
  );
}

export default App;
