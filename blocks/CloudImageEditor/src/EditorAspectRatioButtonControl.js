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
          this.$['title'] = this.l10n('freeform');
          this.$['icon'] = FREEFORM_ID;
        } else {
          this.$['icon'] = value.type;
          if (value.width && value.height) {
            this.$['title'] = `${value.width}:${value.height}`;
          }
          this._renderRectBasedOnAspectRatio(value);
        }

        this._aspectRatio = value;

        this.bindL10n('title-prop', () => {
          const isFreeform = !!value.hasFreeform;
          const name = this.l10n(isFreeform ? 'freeform' : value.type).toLowerCase();

          const val = isFreeform ? '' : `${value.width}:${value.height}`;
          return this.l10n('a11y-cloud-editor-apply-aspect-ratio', { name, value: val });
        });
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

    const list = /** @type {import('./types.js').CropPresetList} */ (this.$['*cropPresetList']);
    if (!Array.isArray(list)) return;

    this.$['*cropPresetList'] = list.map(
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

    const svgEl = this.ref['icon-el']?.ref?.svg;

    if (!svgEl) return;
    svgEl.innerHTML = '';
    svgEl.appendChild(rect);
  }
}
