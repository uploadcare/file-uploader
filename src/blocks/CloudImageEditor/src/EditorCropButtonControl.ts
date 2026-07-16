import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { EditorButtonControl } from './EditorButtonControl.js';
import type { CropOperation } from './toolbar-constants';
import type { Transformations } from './types';

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

    // Crop ops are modelled through state: write the next value to
    // `*editorTransformations`; the cropper reacts (applies + re-commits the
    // consistent crop). No element ref needed — see `EditorImageCropper`.
    const transformations = this.editorController.get('*editorTransformations');
    const prev = (transformations[this.operation] ?? (this.operation === 'rotate' ? 0 : false)) as number | boolean;
    const next = nextValue(this.operation, prev);

    this.editorController.telemetry.sendEventCloudImageEditor(e, this.editorController.get('*tabId'), {
      operation: this.operation,
      next,
      prev,
    });

    this.editorController.set('*editorTransformations', {
      ...transformations,
      [this.operation]: next,
    } as Transformations);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-crop-button-control': EditorCropButtonControl;
  }
}
