import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { renderAspectRatioIcon } from '../../Icon/aspectRatioIcon';
import { EditorButtonControl } from './EditorButtonControl.js';
import type { CropAspectRatio } from './types';

import '../../Icon/Icon';

export class EditorFreeformButtonControl extends EditorButtonControl {
  public override initCallback(): void {
    super.initCallback();

    this.icon = 'arrow-dropdown';

    this.sub('*currentAspectRatio', (opt: CropAspectRatio | null) => {
      const title = this._computeTitle(opt);
      this.title = title;
      this.titleProp = title;
    });
  }

  public override onClick(): void {
    this.$['*showListAspectRatio'] = true;
  }

  private _computeTitle(aspectRatio: CropAspectRatio | null): string {
    if (!aspectRatio) {
      return '';
    }
    return aspectRatio.hasFreeform
      ? this.l10n('freeform-crop')
      : this.l10n('crop-to-shape', { value: `${aspectRatio.width}:${aspectRatio.height}` });
  }

  public override render() {
    const clickHandler = this.onClick;
    const title = this.title;
    return html`
      <button
        role="option"
        aria-selected=${this.active ? 'true' : 'false'}
        type="button"
        class=${classMap(this.buttonClasses)}
        aria-label=${ifDefined(this.titleProp)}
        title=${ifDefined(this.titleProp)}
        @click=${clickHandler}
      >
        <div class="uc-title" ?hidden=${!title}>${title}</div>
        <uc-icon name=${this.icon}></uc-icon>
      </button>
    `;
  }
}
export class EditorAspectRatioButtonControl extends EditorButtonControl {
  private _aspectRatio: CropAspectRatio | null = null;

  @property({ attribute: false })
  public get aspectRatio(): CropAspectRatio | null {
    return this._aspectRatio;
  }

  public set aspectRatio(value: CropAspectRatio | null) {
    if (this._aspectRatio === value) {
      return;
    }
    const previous = this._aspectRatio;
    this._aspectRatio = value;
    this.requestUpdate('aspectRatio', previous);
    if (value) {
      this._updateAspectRatioPresentation(value);
    } else {
      this.removeAttribute('uc-aspect-ratio-freeform');
      this.title = '';
      this.titleProp = '';
    }
  }

  public override initCallback(): void {
    super.initCallback();

    if (this._aspectRatio) {
      this._updateAspectRatioPresentation(this._aspectRatio);
    }

    this.sub('*currentAspectRatio', (opt: CropAspectRatio | null) => {
      this.active =
        (opt && opt.id === this._aspectRatio?.id) ||
        (opt?.width === this._aspectRatio?.width && opt?.height === this._aspectRatio?.height);
    });
  }

  protected override onClick(): void {
    const currentAspectRatio = this.$['*currentAspectRatio'] as CropAspectRatio | undefined;
    if (currentAspectRatio?.id === this._aspectRatio?.id) {
      return;
    }

    this.$['*currentAspectRatio'] = this._aspectRatio;
  }

  private _updateAspectRatioPresentation(value: CropAspectRatio): void {
    if (!this.isConnected) return;
    const isFreeform = !!value.hasFreeform;
    this.toggleAttribute('uc-aspect-ratio-freeform', isFreeform);

    const resolveTitle = () => {
      const titleText = isFreeform ? this.l10n('custom') : `${value.width}:${value.height}`;
      this.title = titleText;
      return titleText;
    };

    const resolveTitleProp = () => {
      const label = this.l10n('a11y-cloud-editor-apply-aspect-ratio', {
        name: isFreeform
          ? this.l10n('custom').toLowerCase()
          : this.l10n('crop-to-shape', { value: `${value.width}:${value.height}` }).toLowerCase(),
        value: '',
      });
      this.titleProp = label;
      return label;
    };

    resolveTitle();
    resolveTitleProp();

    if (!isFreeform) {
      this.requestUpdate();
    }
  }

  private _renderIcon() {
    const ratio = this._aspectRatio;
    if (!ratio || ratio.hasFreeform) {
      return html`<uc-icon name=${this.icon}></uc-icon>`;
    }

    return renderAspectRatioIcon(ratio.width, ratio.height);
  }

  public override render() {
    const clickHandler = this.onClick;
    const title = this.title;
    return html`
      <button
        role="option"
        aria-selected=${this.active ? 'true' : 'false'}
        type="button"
        class=${classMap(this.buttonClasses)}
        aria-label=${ifDefined(this.titleProp)}
        title=${ifDefined(this.titleProp)}
        @click=${clickHandler}
      >
        ${this._renderIcon()}
        <div class="uc-title" ?hidden=${!title}>${title}</div>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-freeform-button-control': EditorFreeformButtonControl;
    'uc-editor-aspect-ratio-button-control': EditorAspectRatioButtonControl;
  }
}
