import { BlockComponent } from '../BlockComponent/BlockComponent.js';

const TOOLBAR_TPL = /*html*/ `
<button>Rotate 90</button>
<button>Flip horizontal</button>
<button>Flip vertical</button>
<button>Brightness</button>
<button>Saturation</button>
<button>Crop</button>
<button>Add text</button>
<button>Draw</button>
`;

export class LocalEditor extends BlockComponent {
  constructor() {
    super();
    this.pauseRender = true;
  }

  initCallback() {
    this.canvas = this.querySelector('canvas');
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.appendChild(this.canvas);
    }
    this.canvCtx = this.canvas.getContext('2d');
    this.canvParent = this.canvas.parentElement;
    this.toolbar = document.createElement('div');
    this.toolbar.classList.add('local-editor-toolbar');
    this.canvParent.appendChild(this.toolbar);
    this.toolbar.innerHTML = TOOLBAR_TPL;
  }
}
