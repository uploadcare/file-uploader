import { EditorButtonControl } from './EditorButtonControl.js';

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
  initCallback() {
    super.initCallback();

    this.defineAccessor('operation', (operation) => {
      if (!operation) {
        return;
      }

      /** @private */
      this._operation = operation;
      this.$['icon'] = operation;
      this.bindL10n('title-prop', () =>
        this.l10n('a11y-cloud-editor-apply-crop', {
          name: this.l10n(operation).toLowerCase(),
        }),
      );
    });

    this.$['on.click'] = () => {
      let prev = this.$['*cropperEl'].getValue(this._operation);
      let next = nextValue(this._operation, prev);
      this.$['*cropperEl'].setValue(this._operation, next);
    };
  }
}
