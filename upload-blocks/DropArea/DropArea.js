import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

export class DropArea extends BaseComponent {}

DropArea.template = /*html*/ `
<div -sources->
  <slot></slot>
</div>
<div -dropzone->
  <div -drop-txt-></div>
</div>
`;