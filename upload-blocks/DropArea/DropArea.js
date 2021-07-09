import { AppComponent } from '../AppComponent/AppComponent.js';

export class DropArea extends AppComponent {

}

DropArea.template = /*html*/ `
<div sources>
  <slot></slot>
</div>
<div dropzone>
  <div drop-txt>Or drop files here...</div>
</div>
`;