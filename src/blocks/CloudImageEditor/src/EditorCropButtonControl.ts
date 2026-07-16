import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { EditorButtonControl } from './EditorButtonControl.js';
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

export class EditorCropButtonControl extends EditorButtonControl {
  @property({ type: String })
  public operation: CropOperation | undefined = undefined;

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (this.operation) {
      this.titleProp = this.l10nSafe('a11y-cloud-editor-apply-crop', {
        name: this.l10nSafe(this.operation).toLowerCase(),
      });
      this.icon = this.operation;
    } else {
      this.icon = '';
      this.titleProp = '';
    }
  }

  protected override onClick(e: MouseEvent) {
    if (!this.operation) {
      return;
    }

    // `*cropperEl` is null unless the cropper is the mounted/active tab — a
    // crop op can be clicked before it registers (or from another tab). Guard
    // rather than crash (matches the `?.` at the root's activate/deactivate).
    const cropper = this.editorController.get('*cropperEl');
    if (!cropper) {
      return;
    }
    const prev = cropper.getValue(this.operation);
    const next = nextValue(this.operation, prev);

    this.editorController.telemetry.sendEventCloudImageEditor(e, this.editorController.get('*tabId'), {
      operation: this.operation,
      next,
      prev,
    });

    cropper.setValue(this.operation, next);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-crop-button-control': EditorCropButtonControl;
  }
}
