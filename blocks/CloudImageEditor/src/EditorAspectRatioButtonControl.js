//@ts-check

import { extractUuid } from '../../../utils/cdn-utils.js';
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

    this.$['title'] = this.l10n('crop-shape');
    this.$['icon'] = 'freeform';

    this.bindL10n('title-prop', () => {
      return this.l10n('crop-shape');
    });

    this.$['on.click'] = this.handleClick.bind(this);
  }

  handleClick() {
    this.$['*showListAspectRatio'] = true;
  }
}

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
        const name = this.l10n(isFreeform ? 'custom' : value.type).toLowerCase();

        this.$['icon'] = isFreeform ? 'freeform' : value.type;
        this.$['title'] = isFreeform ? this.l10n('custom') : `${value.width}:${value.height}`;

        if (!isFreeform) {
          this._renderRectBasedOnAspectRatio(value);
        }

        this._aspectRatio = value;

        this.bindL10n('title-prop', () => {
          const val = isFreeform ? '' : `${value.width}:${value.height}`;
          return this.l10n('a11y-cloud-editor-apply-aspect-ratio', {
            name,
            value: val,
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

    try {
      const storageKey = 'editor.aspectRatios';
      const hash = extractUuid(this.$['*originalUrl']);

      let map;
      try {
        //@ts-ignore
        map = JSON.parse(sessionStorage.getItem(storageKey)) || {};
      } catch {
        map = {};
      }

      map[hash] = this._aspectRatio;

      sessionStorage.setItem(storageKey, JSON.stringify(map));
    } catch {}
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
      width,
      height,
    });

    const svgEl = this.ref['icon-el']?.ref?.svg;

    if (!svgEl) return;
    svgEl.innerHTML = '';
    svgEl.appendChild(rect);
  }
}
