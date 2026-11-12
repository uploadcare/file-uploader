import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { renderAspectRatioSvg } from '../../Icon/aspectRatioIcon';
import type { CloudImageEditorController } from './CloudImageEditorController';
import { EditorButtonControl } from './EditorButtonControl.js';
import type { CropAspectRatio } from './types';

import './EditorIcon';

/** Bubbles up to `EditorToolbar`, which owns the toolbar-local `showListAspectRatio` state. */
export class ShowAspectRatioListEvent extends Event {
  public static readonly eventName = 'uc-internal:show-aspect-ratio-list';
  public constructor() {
    super(ShowAspectRatioListEvent.eventName, { bubbles: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    [ShowAspectRatioListEvent.eventName]: ShowAspectRatioListEvent;
  }
}

export class EditorFreeformButtonControl extends EditorButtonControl {
  public override onClick(): void {
    this.dispatchEvent(new ShowAspectRatioListEvent());
  }

  // Named after the current preset, which `EditorBlock` re-renders on.
  protected override updateLabels(): void {
    this.icon = 'arrow-dropdown';
    const aspectRatio = this.editorControllerOrNull?.currentAspectRatio ?? null;
    this.caption = !aspectRatio
      ? ''
      : aspectRatio.hasFreeform
        ? this.l10nSafe('freeform-crop')
        : this.l10nSafe('crop-to-shape', { value: `${aspectRatio.width}:${aspectRatio.height}` });
    this.buttonLabel = this.caption;
  }

  /** The caption comes before the dropdown arrow. */
  protected override renderContent(): TemplateResult {
    return html`${this.renderCaption()}<uc-editor-icon name=${this.icon}></uc-editor-icon>`;
  }
}

export class EditorAspectRatioButtonControl extends EditorButtonControl {
  @property({ attribute: false })
  public aspectRatio: CropAspectRatio | null = null;

  protected override isActive(controller: CloudImageEditorController): boolean {
    const opt = controller.currentAspectRatio;
    return (
      (opt && opt.id === this.aspectRatio?.id) ||
      (opt?.width === this.aspectRatio?.width && opt?.height === this.aspectRatio?.height)
    );
  }

  protected override onClick(): void {
    const currentAspectRatio = this.editorController.currentAspectRatio;
    if (currentAspectRatio?.id === this.aspectRatio?.id) {
      return;
    }

    this.editorController.currentAspectRatio = this.aspectRatio;
  }

  protected override updateLabels(): void {
    const value = this.aspectRatio;
    this.toggleAttribute('uc-aspect-ratio-freeform', !!value?.hasFreeform);
    if (!value) {
      this.caption = '';
      this.buttonLabel = '';
      return;
    }
    const shape = `${value.width}:${value.height}`;
    this.caption = value.hasFreeform ? this.l10nSafe('custom') : shape;
    this.buttonLabel = this.l10nSafe('a11y-cloud-editor-apply-aspect-ratio', {
      name: (value.hasFreeform
        ? this.l10nSafe('custom')
        : this.l10nSafe('crop-to-shape', { value: shape })
      ).toLowerCase(),
      value: '',
    });
  }

  private _renderIcon() {
    const ratio = this.aspectRatio;
    if (!ratio || ratio.hasFreeform) {
      return html`<uc-editor-icon name=${this.icon}></uc-editor-icon>`;
    }

    return html`<uc-editor-icon>${renderAspectRatioSvg(ratio.width, ratio.height)}</uc-editor-icon>`;
  }

  protected override renderContent(): TemplateResult {
    return html`${this._renderIcon()}${this.renderCaption()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-freeform-button-control': EditorFreeformButtonControl;
    'uc-editor-aspect-ratio-button-control': EditorAspectRatioButtonControl;
  }
}
