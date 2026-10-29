import { property } from 'lit/decorators.js';
import { EditorButtonControl } from './EditorButtonControl.js';
import type { CropOperation } from './toolbar-constants';
import type { Transformations } from './types';

function nextAngle(prev: number): number {
  let angle = prev + 90;
  angle = angle >= 360 ? 0 : angle;
  return angle;
}

export class EditorCropButtonControl extends EditorButtonControl {
  @property({ type: String })
  public operation: CropOperation | undefined = undefined;

  protected override updateLabels(): void {
    if (this.operation) {
      this.buttonLabel = this.l10nSafe('a11y-cloud-editor-apply-crop', {
        name: this.l10nSafe(this.operation).toLowerCase(),
      });
      this.icon = this.operation;
    } else {
      this.icon = '';
      this.buttonLabel = '';
    }
  }

  protected override onClick(e: MouseEvent) {
    if (!this.operation) {
      return;
    }

    // Crop ops are modelled through state: write the next value to
    // `editorTransformations`; the cropper reacts (applies + re-commits the
    // consistent crop). No element ref needed — see `EditorImageCropper`.
    // Branch per operation so `patch` is a strongly-typed `Partial<Transformations>`
    // (`rotate` is a number, `flip`/`mirror` are booleans) — no assertions.
    const transformations = this.editorController.editorTransformations;
    let prev: number | boolean;
    let next: number | boolean;
    let patch: Partial<Transformations>;
    if (this.operation === 'rotate') {
      prev = transformations.rotate ?? 0;
      next = nextAngle(prev);
      patch = { rotate: next };
    } else if (this.operation === 'flip') {
      prev = transformations.flip ?? false;
      next = !prev;
      patch = { flip: next };
    } else {
      prev = transformations.mirror ?? false;
      next = !prev;
      patch = { mirror: next };
    }

    this.sendClickEvent(e, {
      operation: this.operation,
      next,
      prev,
    });

    this.editorController.editorTransformations = { ...transformations, ...patch };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-crop-button-control': EditorCropButtonControl;
  }
}
