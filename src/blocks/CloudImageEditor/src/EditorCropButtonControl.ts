import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { EditorButtonControl } from './EditorButtonControl.js';
import type { EditorImageCropper } from './EditorImageCropper.js';
import type { CropOperation } from './toolbar-constants';

type CropperOperationKey = 'rotate' | 'mirror' | 'flip';
type CropperOperationValue<K extends CropperOperationKey> = K extends 'rotate' ? number : boolean;

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
      this.titleProp = this.l10n('a11y-cloud-editor-apply-crop', {
        name: this.l10n(this.operation).toLowerCase(),
      });
      this.icon = this.operation;
    } else {
      this.icon = '';
      this.titleProp = '';
    }
  }

  protected override onClick(e: MouseEvent) {
    if (!this.operation) return;

    const cropper = this.editor.get('*cropperEl') as EditorImageCropper | null;
    if (!cropper) return;
    const op = this.operation as CropperOperationKey;
    const prev = cropper.getValue(op) as CropperOperationValue<typeof op>;
    const next = nextValue(this.operation, prev);

    this.telemetryManager.sendEventCloudImageEditor(e, String(this.editor.get('*tabId')), {
      operation: this.operation,
      next,
      prev,
    });

    cropper.setValue(op, next as CropperOperationValue<typeof op>);
  }
}

if (!customElements.get('uc-editor-crop-button-control')) {
  customElements.define('uc-editor-crop-button-control', EditorCropButtonControl);
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-crop-button-control': EditorCropButtonControl;
  }
}
