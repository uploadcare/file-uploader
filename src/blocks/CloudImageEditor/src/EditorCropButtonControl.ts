import { EditorButtonControl } from './EditorButtonControl.js';
import type { EditorImageCropper } from './EditorImageCropper.js';
import type { CropOperation } from './toolbar-constants';

function nextAngle(prev: number): number {
  let angle = prev + 90;
  angle = angle >= 360 ? 0 : angle;
  return angle;
}

function nextValue(operation: CropOperation, prev: number | boolean): number | boolean {
  if (operation === 'rotate') {
    const angle = typeof prev === 'number' ? prev : 0;
    return nextAngle(angle);
  }
  if (operation === 'mirror' || operation === 'flip') {
    return !prev;
  }
  throw new Error(`Unsupported operation: ${operation}`);
}

export interface EditorCropButtonControl {
  get operation(): CropOperation | undefined;
  set operation(value: CropOperation | undefined);
}

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: This is intentional interface merging, used to add configuration setters/getters
export class EditorCropButtonControl extends EditorButtonControl {
  private _operation: CropOperation | undefined = undefined;

  override initCallback(): void {
    super.initCallback();

    this.defineAccessor('operation', (operation?: CropOperation) => {
      if (!operation) {
        return;
      }

      this._operation = operation;
      this.$.icon = operation;

      this.bindL10n('title-prop', () =>
        this.l10n('a11y-cloud-editor-apply-crop', {
          name: this.l10n(operation).toLowerCase(),
        }),
      );
    });

    this.$['on.click'] = (e: MouseEvent) => {
      if (!this._operation) {
        return;
      }

      const cropper = this.$['*cropperEl'] as EditorImageCropper;
      const prev = cropper.getValue(this._operation);
      const next = nextValue(this._operation, prev);

      this.telemetryManager.sendEventCloudImageEditor(e, this.$['*tabId'], {
        operation: this._operation,
        next,
        prev,
      });

      cropper.setValue(this._operation, next);
    };
  }
}
