//@ts-check

import { createSvgNode } from './crop-utils.js';
import { EditorButtonControl } from './EditorButtonControl.js';

const SIZE_RECT_FIXED = 12;
const SIZE_SVG_WRAPPER = 16;

/** @param {import('./types.js').CropAspectRatio} value */
const getAdjustResolutions = (value) => {
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
  constructor() {
    super();
  }

  initCallback() {
    super.initCallback();

    this.$['icon'] = 'arrow-dropdown';
    this.$['on.click'] = this.handleClick.bind(this);

    this.sub('*currentAspectRatio', (opt) => {
      this.$['title'] = opt.hasFreeform
        ? this.l10n('freeform-crop')
        : this.l10n('crop-to-shape', { value: `${opt.width}:${opt.height}` });

      this.bindL10n('title-prop', () => this.$['title']);
    });
  }

  handleClick() {
    this.$['*showListAspectRatio'] = true;
  }
}

EditorFreeformButtonControl.template = /* html */ ` 
  <button role="option" type="button" set="@aria-label:title-prop;" l10n="@title:title-prop;">
    <div class="uc-title" ref="title-el">{{title}}</div>
    <uc-icon ref="icon-el" set="@name: icon;"></uc-icon>
  </button> 
`;

export class EditorAspectRatioButtonControl extends EditorButtonControl {
  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      active: false,
      once: false,
    };
  }
  initCallback() {
    super.initCallback();

    this.defineAccessor(
      'aspectRatio',
      /** @param {import('./types.js').CropAspectRatio} value */ (value) => {
        if (!value) return;

        const isFreeform = !!value.hasFreeform;
        this.$['title'] = isFreeform ? this.l10n('custom') : `${value.width}:${value.height}`;

        if (!isFreeform) {
          this._renderRectBasedOnAspectRatio(value);
        }

        if (isFreeform) {
          this.setAttribute('uc-aspect-ratio-freeform', '');
        }

        this._aspectRatio = value;

        this.bindL10n('title-prop', () => {
          return this.l10n('a11y-cloud-editor-apply-aspect-ratio', {
            name: isFreeform
              ? this.l10n('custom').toLowerCase()
              : this.l10n('crop-to-shape', { value: `${value.width}:${value.height}` }).toLowerCase(),
            value: '',
          });
        });
      },
    );

    this.sub('*currentAspectRatio', (opt) => {
      this.$.active =
        (opt && opt.id === this._aspectRatio?.id) ||
        (opt?.width === this._aspectRatio?.width && opt?.height === this._aspectRatio?.height);
    });

    this.$['on.click'] = this.handleClick.bind(this);
  }

  handleClick() {
    if (this.$['*currentAspectRatio']?.id === this._aspectRatio?.id) {
      return;
    }

    this.$['*currentAspectRatio'] = this._aspectRatio;
  }

  /** @param {import('./types.js').CropAspectRatio} value */
  _renderRectBasedOnAspectRatio(value) {
    const { width, height } = getAdjustResolutions(value);

    const rect = createSvgNode('rect', {
      'stroke-linejoin': 'round',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.2,
      'fill-rule': 'evenodd',
      x: (SIZE_SVG_WRAPPER - width) / 2,
      y: (SIZE_SVG_WRAPPER - height) / 2,
      rx: 2,
      width,
      height,
    });

    const svgEl = this.ref['icon-el']?.ref?.svg;

    if (!svgEl) return;
    svgEl.innerHTML = '';
    svgEl.appendChild(rect);
  }
}
