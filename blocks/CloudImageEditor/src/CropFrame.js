// @ts-check
import { Block } from '../../../abstract/Block.js';
import {
  clamp,
  constraintRect,
  cornerPath,
  createSvgNode,
  moveRect,
  rectContainsPoint,
  resizeRect,
  roundRect,
  setSvgNodeAttrs,
  sidePath,
  thumbCursor,
} from './crop-utils.js';
import {
  GUIDE_STROKE_WIDTH,
  GUIDE_THIRD,
  MAX_INTERACTION_SIZE,
  MIN_CROP_SIZE,
  MIN_INTERACTION_SIZE,
  THUMB_CORNER_SIZE,
  THUMB_SIDE_SIZE,
  THUMB_STROKE_WIDTH,
} from './cropper-constants.js';
import { classNames } from './lib/classNames.js';

export class CropFrame extends Block {
  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      dragging: false,
    };

    /** @private */
    this._handlePointerUp = this._handlePointerUp_.bind(this);

    /** @private */
    this._handlePointerMove = this._handlePointerMove_.bind(this);

    /** @private */
    this._handleSvgPointerMove = this._handleSvgPointerMove_.bind(this);
  }

  /**
   * @private
   * @param {import('./types.js').Direction} direction
   */
  _shouldThumbBeDisabled(direction) {
    const imageBox = this.$['*imageBox'];
    if (!imageBox) {
      return;
    }

    if (direction === '' && imageBox.height <= MIN_CROP_SIZE && imageBox.width <= MIN_CROP_SIZE) {
      return true;
    }

    const tooHigh = imageBox.height <= MIN_CROP_SIZE && (direction.includes('n') || direction.includes('s'));
    const tooWide = imageBox.width <= MIN_CROP_SIZE && (direction.includes('e') || direction.includes('w'));
    return tooHigh || tooWide;
  }

  /** @private */
  _createBackdrop() {
    /** @type {import('./types.js').Rectangle} */
    const cropBox = this.$['*cropBox'];
    if (!cropBox) {
      return;
    }
    const { x, y, width, height } = cropBox;
    const svg = this.ref['svg-el'];

    const mask = createSvgNode('mask', { id: 'backdrop-mask' });
    const maskRectOuter = createSvgNode('rect', {
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      fill: 'white',
    });
    const maskRectInner = createSvgNode('rect', {
      x,
      y,
      width,
      height,
      fill: 'black',
    });
    mask.appendChild(maskRectOuter);
    mask.appendChild(maskRectInner);

    const backdropRect = createSvgNode('rect', {
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      fill: 'var(--color-image-background)',
      'fill-opacity': 0.85,
      mask: 'url(#backdrop-mask)',
    });
    svg.appendChild(backdropRect);
    svg.appendChild(mask);

    this._backdropMask = mask;
    this._backdropMaskInner = maskRectInner;
  }

  /**
   * @private Super Tricky workaround for the chromium bug See
   *   https://bugs.chromium.org/p/chromium/issues/detail?id=330815
   */
  _resizeBackdrop() {
    if (!this._backdropMask) {
      return;
    }
    this._backdropMask.style.display = 'none';
    window.requestAnimationFrame(() => {
      if (this._backdropMask) {
        this._backdropMask.style.display = 'block';
      }
    });
  }

  /** @private */
  _updateBackdrop() {
    /** @type {import('./types.js').Rectangle} */
    const cropBox = this.$['*cropBox'];
    if (!cropBox) {
      return;
    }
    const { x, y, width, height } = cropBox;

    this._backdropMaskInner && setSvgNodeAttrs(this._backdropMaskInner, { x, y, width, height });
  }

  /** @private */
  _updateFrame() {
    /** @type {import('./types.js').Rectangle} */
    const cropBox = this.$['*cropBox'];

    if (!cropBox || !this._frameGuides || !this._frameThumbs) {
      return;
    }
    for (const thumb of Object.values(this._frameThumbs)) {
      const { direction, pathNode, interactionNode, groupNode } = thumb;
      const isCenter = direction === '';
      const isCorner = direction.length === 2;
      const { x, y, width, height } = cropBox;

      if (isCenter) {
        const moveThumbRect = {
          x: x + width / 3,
          y: y + height / 3,
          width: width / 3,
          height: height / 3,
        };
        setSvgNodeAttrs(interactionNode, moveThumbRect);
      } else {
        const thumbSizeMultiplier = clamp(
          Math.min(width, height) / (THUMB_CORNER_SIZE * 2 + THUMB_SIDE_SIZE) / 2,
          0,
          1,
        );

        const { d, center } = isCorner
          ? cornerPath(cropBox, direction, thumbSizeMultiplier)
          : sidePath(
              cropBox,
              /** @type {Extract<import('./types.js').Direction, 'n' | 's' | 'w' | 'e'>} */ (direction),
              thumbSizeMultiplier,
            );
        const size = Math.max(
          MAX_INTERACTION_SIZE * clamp(Math.min(width, height) / MAX_INTERACTION_SIZE / 3, 0, 1),
          MIN_INTERACTION_SIZE,
        );
        setSvgNodeAttrs(interactionNode, {
          x: center[0] - size,
          y: center[1] - size,
          width: size * 2,
          height: size * 2,
        });
        setSvgNodeAttrs(pathNode, { d });
      }

      const disableThumb = this._shouldThumbBeDisabled(direction);
      groupNode.setAttribute(
        'class',
        classNames('thumb', {
          'thumb--hidden': disableThumb,
          'thumb--visible': !disableThumb,
        }),
      );
    }

    setSvgNodeAttrs(this._frameGuides, {
      x: cropBox.x - GUIDE_STROKE_WIDTH * 0.5,
      y: cropBox.y - GUIDE_STROKE_WIDTH * 0.5,
      width: cropBox.width + GUIDE_STROKE_WIDTH,
      height: cropBox.height + GUIDE_STROKE_WIDTH,
    });
  }

  /** @private */
  _createThumbs() {
    /**
     * @type {Partial<{
     *   [K in import('./types.js').Direction]: {
     *     direction: import('./types.js').Direction;
     *     pathNode: SVGElement;
     *     interactionNode: SVGElement;
     *     groupNode: SVGElement;
     *   };
     * }>}
     */
    const frameThumbs = {};

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const direction = /** @type {import('./types.js').Direction} */ (`${['n', '', 's'][i]}${['w', '', 'e'][j]}`);
        const groupNode = createSvgNode('g');
        groupNode.classList.add('thumb');
        groupNode.setAttribute('with-effects', '');
        const interactionNode = createSvgNode('rect', {
          fill: 'transparent',
        });
        const pathNode = createSvgNode('path', {
          stroke: 'currentColor',
          fill: 'none',
          'stroke-width': THUMB_STROKE_WIDTH,
        });
        groupNode.appendChild(pathNode);
        groupNode.appendChild(interactionNode);
        frameThumbs[direction] = {
          direction,
          pathNode,
          interactionNode,
          groupNode,
        };

        interactionNode.addEventListener('pointerdown', this._handlePointerDown.bind(this, direction));
      }
    }

    return frameThumbs;
  }

  /** @private */
  _createGuides() {
    const svg = createSvgNode('svg');

    const rect = createSvgNode('rect', {
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': GUIDE_STROKE_WIDTH,
      'stroke-opacity': 0.5,
    });
    svg.appendChild(rect);

    for (let i = 1; i <= 2; i++) {
      const line = createSvgNode('line', {
        x1: `${GUIDE_THIRD * i}%`,
        y1: '0%',
        x2: `${GUIDE_THIRD * i}%`,
        y2: '100%',
        stroke: 'currentColor',
        'stroke-width': GUIDE_STROKE_WIDTH,
        'stroke-opacity': 0.3,
      });
      svg.appendChild(line);
    }

    for (let i = 1; i <= 2; i++) {
      const line = createSvgNode('line', {
        x1: '0%',
        y1: `${GUIDE_THIRD * i}%`,
        x2: '100%',
        y2: `${GUIDE_THIRD * i}%`,
        stroke: 'currentColor',
        'stroke-width': GUIDE_STROKE_WIDTH,
        'stroke-opacity': 0.3,
      });
      svg.appendChild(line);
    }

    svg.classList.add('guides', 'guides--semi-hidden');

    return svg;
  }

  /** @private */
  _createFrame() {
    const svg = this.ref['svg-el'];
    const fr = document.createDocumentFragment();

    const frameGuides = this._createGuides();
    fr.appendChild(frameGuides);

    const frameThumbs = this._createThumbs();
    for (const { groupNode } of Object.values(frameThumbs)) {
      fr.appendChild(groupNode);
    }

    svg.appendChild(fr);
    this._frameThumbs = frameThumbs;
    this._frameGuides = frameGuides;
  }

  /**
   * @private
   * @param {import('./types.js').Direction} direction
   * @param {PointerEvent} e
   */
  _handlePointerDown(direction, e) {
    if (!this._frameThumbs) return;
    const thumb = this._frameThumbs[direction];
    if (this._shouldThumbBeDisabled(direction)) {
      return;
    }

    const cropBox = this.$['*cropBox'];
    const { x: svgX, y: svgY } = this.ref['svg-el'].getBoundingClientRect();
    const x = e.x - svgX;
    const y = e.y - svgY;

    this.$.dragging = true;
    this._draggingThumb = thumb;
    this._dragStartPoint = [x, y];
    /** @type {import('./types.js').Rectangle} */
    this._dragStartCrop = { ...cropBox };
  }

  /**
   * @private
   * @param {PointerEvent} e
   */
  _handlePointerUp_(e) {
    this._updateCursor();

    if (!this.$.dragging) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    this.$.dragging = false;
  }

  /**
   * @private
   * @param {PointerEvent} e
   */
  _handlePointerMove_(e) {
    if (!this.$.dragging || !this._dragStartPoint || !this._draggingThumb) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    const svg = this.ref['svg-el'];
    const { x: svgX, y: svgY } = svg.getBoundingClientRect();
    const x = e.x - svgX;
    const y = e.y - svgY;
    const dx = x - this._dragStartPoint[0];
    const dy = y - this._dragStartPoint[1];
    const { direction } = this._draggingThumb;

    const movedCropBox = this._calcCropBox(direction, [dx, dy]);
    if (movedCropBox) {
      this.$['*cropBox'] = movedCropBox;
    }
  }

  /**
   * @private
   * @param {import('./types.js').Direction} direction
   * @param {[Number, Number]} delta
   */
  _calcCropBox(direction, delta) {
    const [dx, dy] = delta;
    /** @type {import('./types.js').Rectangle} */
    const imageBox = this.$['*imageBox'];
    let rect = /** @type {import('./types.js').Rectangle} */ (this._dragStartCrop) ?? this.$['*cropBox'];
    /** @type {import('./types.js').CropPresetList[0]} */
    const cropPreset = this.$['*cropPresetList']?.[0];
    const aspectRatio = cropPreset ? cropPreset.width / cropPreset.height : undefined;

    if (direction === '') {
      rect = moveRect({ rect, delta: [dx, dy], imageBox });
    } else {
      rect = resizeRect({ rect, delta: [dx, dy], direction, aspectRatio, imageBox });
    }

    if (!Object.values(rect).every((number) => Number.isFinite(number) && number >= 0)) {
      console.error('CropFrame is trying to create invalid rectangle', {
        payload: rect,
      });
      return;
    }
    return constraintRect(roundRect(rect), this.$['*imageBox']);
  }

  /**
   * @private
   * @param {PointerEvent} e
   */
  _handleSvgPointerMove_(e) {
    if (!this._frameThumbs) return;

    const hoverThumb = Object.values(this._frameThumbs).find((thumb) => {
      if (this._shouldThumbBeDisabled(thumb.direction)) {
        return false;
      }
      const node = thumb.interactionNode;
      const bounds = node.getBoundingClientRect();
      const rect = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
      const hover = rectContainsPoint(rect, [e.x, e.y]);
      return hover;
    });

    this._hoverThumb = hoverThumb;
    this._updateCursor();
  }

  /** @private */
  _updateCursor() {
    const hoverThumb = this._hoverThumb;
    this.ref['svg-el'].style.cursor = hoverThumb ? thumbCursor(hoverThumb.direction) : 'initial';
  }

  /** @private */
  _render() {
    this._updateBackdrop();
    this._updateFrame();
  }

  /** @param {boolean} visible */
  toggleThumbs(visible) {
    if (!this._frameThumbs) return;

    for (const thumb of Object.values(this._frameThumbs)) {
      const { groupNode } = thumb;
      groupNode.setAttribute(
        'class',
        classNames('thumb', {
          'thumb--hidden': !visible,
          'thumb--visible': visible,
        }),
      );
    }
  }

  initCallback() {
    super.initCallback();

    this._createBackdrop();
    this._createFrame();

    this.sub('*imageBox', () => {
      this._resizeBackdrop();
      window.requestAnimationFrame(() => {
        this._render();
      });
    });

    this.sub('*cropBox', (cropBox) => {
      if (!cropBox) {
        return;
      }
      this._guidesHidden = cropBox.height <= MIN_CROP_SIZE || cropBox.width <= MIN_CROP_SIZE;
      window.requestAnimationFrame(() => {
        this._render();
      });
    });

    this.sub('dragging', (dragging) => {
      if (!this._frameGuides) return;
      this._frameGuides.setAttribute(
        'class',
        classNames({
          'guides--hidden': this._guidesHidden,
          'guides--visible': !this._guidesHidden && dragging,
          'guides--semi-hidden': !this._guidesHidden && !dragging,
        }),
      );
    });

    this.ref['svg-el'].addEventListener('pointermove', this._handleSvgPointerMove, true);
    document.addEventListener('pointermove', this._handlePointerMove, true);
    document.addEventListener('pointerup', this._handlePointerUp, true);
  }

  destroyCallback() {
    super.destroyCallback();

    document.removeEventListener('pointermove', this._handlePointerMove);
    document.removeEventListener('pointerup', this._handlePointerUp);
  }
}

CropFrame.template = /* HTML */ ` <svg class="svg" ref="svg-el" xmlns="http://www.w3.org/2000/svg"></svg> `;
