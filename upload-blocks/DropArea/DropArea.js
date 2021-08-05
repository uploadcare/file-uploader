import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class DropArea extends BlockComponent {}

DropArea.template = /*html*/ `
<div -sources->
  <slot></slot>
</div>
<div -dropzone->
  <div -drop-txt-></div>
</div>
`;