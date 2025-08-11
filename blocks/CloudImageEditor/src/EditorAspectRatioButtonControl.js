//@ts-check

import { createSvgNode } from './crop-utils.js';
import { EditorButtonControl } from './EditorButtonControl.js';

const FREEFORM_ID = 'freeform';

export class EditorAspectRatioButtonControl extends EditorButtonControl {
  initCallback() {
    super.initCallback();

    this.defineAccessor(
      'aspectRatio',
      /** @param {import('./types.js').CropAspectRatio} value */ (value) => {
        if (!value) return;

        if (value.hasFreeform) {
          this.$['title'] = FREEFORM_ID;
          this.$['icon'] = FREEFORM_ID;
        } else {
          this.$['icon'] = value.type;
          if (value.width && value.height) {
            this.$['title'] = `${value.width}:${value.height}`;
          }
          this._renderRectBasedOnAspectRatio(value);
        }

        this._aspectRatio = value;

        this.bindL10n('title-prop', () =>
          this.l10n('a11y-cloud-editor-apply-aspect-ratio', {
            name: this.l10n(value.type).toLowerCase(),
            value: `${value.width}:${value.height}`,
          }),
        );
      },
    );

    this.$['on.click'] = this.handleClick.bind(this);
  }

  handleFreedom() {
    this.$['*showListAspectRatio'] = true;
  }

  handleClick() {
    if (this._aspectRatio?.hasFreeform) {
      this.handleFreedom();
      return;
    }

    this.$['*cropPresetList'] = this.$['*cropPresetList'].map(
      /** @param {import('./types.js').CropAspectRatio} it */ (it) => ({
        ...it,
        _active: it.id === this._aspectRatio?.id,
      }),
    );
  }

  /** @param {import('./types.js').CropAspectRatio} value */
  _renderRectBasedOnAspectRatio(value) {
    const SIZE_RECT_FIXED = 12;
    const SIZE_SVG_WRAPPER = 16;
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

    const rect = createSvgNode('rect', {
      'stroke-linejoin': 'round',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.2,
      'fill-rule': 'evenodd',
      x: (SIZE_SVG_WRAPPER - width) / 2,
      y: (SIZE_SVG_WRAPPER - height) / 2,
      width,
      height,
    });

    this.ref['icon-el'].ref['svg'].innerHTML = '';
    this.ref['icon-el'].ref['svg'].appendChild(rect);
  }
}
