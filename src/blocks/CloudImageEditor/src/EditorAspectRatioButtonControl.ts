import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { EditorButtonControl } from './EditorButtonControl.js';
import type { CropAspectRatio } from './types';

const SIZE_RECT_FIXED = 12;
const SIZE_SVG_WRAPPER = 16;

const getAdjustResolutions = (value: CropAspectRatio) => {
  let width = 12;
  let height = 12;
  const adjustResolutions = value.width / value.height;

  if (adjustResolutions >= 1) {
    width = SIZE_RECT_FIXED;
    height = Math.round((SIZE_RECT_FIXED * value.height) / value.width);
  } else {
    height = SIZE_RECT_FIXED;
    width = Math.round((SIZE_RECT_FIXED * value.width) / value.height);
  }

  return { width, height };
};

export class EditorFreeformButtonControl extends EditorButtonControl {
  public override initCallback(): void {
    super.initCallback();

    this.icon = 'arrow-dropdown';

    this.sub('*currentAspectRatio', (opt: CropAspectRatio) => {
      const title = this._computeTitle(opt);
      this.title = title;
      this.titleProp = title;
    });
  }

  public override onClick(): void {
    this.$['*showListAspectRatio'] = true;
  }

  private _computeTitle(aspectRatio?: CropAspectRatio): string {
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
  private _aspectRatio?: CropAspectRatio;

  @property({ attribute: false })
  public get aspectRatio(): CropAspectRatio | undefined {
    return this._aspectRatio;
  }

  public set aspectRatio(value: CropAspectRatio | undefined) {
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

    this.sub('*currentAspectRatio', (opt: CropAspectRatio | undefined) => {
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

    const { width, height } = getAdjustResolutions(ratio);
    const x = (SIZE_SVG_WRAPPER - width) / 2;
    const y = (SIZE_SVG_WRAPPER - height) / 2;

    return html`
      <svg
        viewBox="0 0 ${SIZE_SVG_WRAPPER} ${SIZE_SVG_WRAPPER}"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x=${x}
          y=${y}
          width=${width}
          height=${height}
          rx="2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linejoin="round"
        ></rect>
      </svg>
    `;
  }

  public override render() {
    const clickHandler = this.onClick;
    const title = this.title;
    return html`
      <button
        role="option"
        type="button"
        class=${classMap(this.buttonClasses)}
        aria-label=${ifDefined(this.titleProp)}
        title=${ifDefined(this.titleProp)}
        @click=${clickHandler}
      >
        <uc-icon>${this._renderIcon()}</uc-icon>
        <div class="uc-title" ?hidden=${!title}>${title}</div>
      </button>
    `;
  }
}
