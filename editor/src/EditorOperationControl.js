import { applyElementStyles } from '../../symbiote/core/css_utils.js';
import { EditorButtonControl } from './EditorButtonControl.js';
import { COLOR_OPERATIONS_CONFIG } from './toolbar-constants.js';

const STYLES = {
  ...EditorButtonControl.styles,
};

export class EditorOperationControl extends EditorButtonControl {
  constructor() {
    super();

    this.state['on.click'] = (e) => {
      this._sliderEl.setOperation(this._operation);
      this.pub('*showSlider', true);
      this.pub('*currentOperation', this._operation);
    };

    this.defineAccessor('faderEl', (faderEl) => {
      /** @type {import('./EditorImageFader').EditorImageFader} */
      this._faderEl = faderEl;
    });

    this.defineAccessor('sliderEl', (sliderEl) => {
      /** @type {import('./EditorSlider').EditorSlider} */
      this._sliderEl = sliderEl;
    });

    this.defineAccessor('operation', (operation) => {
      if (operation) {
        this._operation = operation;
        this.state['icon'] = operation;
        this.state.title = operation;
      }
    });
  }

  readyCallback() {
    super.readyCallback();

    this.sub('*editorTransformations', (editorTransformations) => {
      if (!this._operation) {
        return;
      }

      let { zero } = COLOR_OPERATIONS_CONFIG[this._operation];
      let value = editorTransformations[this._operation];
      let isActive = typeof value !== 'undefined' ? value !== zero : false;
      this.state.active = isActive;
    });
  }
}

EditorOperationControl.styles = STYLES;
