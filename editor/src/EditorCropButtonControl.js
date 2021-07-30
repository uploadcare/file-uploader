import { EditorButtonControl } from './EditorButtonControl.js';

const STYLES = {
  ...EditorButtonControl.styles,
};

function nextAngle(prev) {
  let angle = prev + 90;
  angle = angle >= 360 ? 0 : angle;
  return angle;
}

function nextValue(operation, prev) {
  if (operation === 'rotate') {
    return nextAngle(prev);
  }
  if (['mirror', 'flip'].includes(operation)) {
    return !prev;
  }
  return null;
}

export class EditorCropButtonControl extends EditorButtonControl {
  constructor() {
    super();

    this.state['on.click'] = (e) => {
      let prev = this._cropperEl.getValue(this._operation);
      let next = nextValue(this._operation, prev);
      this._cropperEl.setValue(this._operation, next);
    };

    this.defineAccessor('cropperEl', (cropperEl) => {
      this._cropperEl = cropperEl;
    });

    this.defineAccessor('operation', (operation) => {
      if (!operation) {
        return;
      }

      this._operation = operation;
      this.state['icon'] = operation;
    });
  }

  connectedCallback() {
    super.connectedCallback();
  }
}

EditorCropButtonControl.styles = STYLES;
