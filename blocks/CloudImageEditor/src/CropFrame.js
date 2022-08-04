import { Block } from '../../../abstract/Block.js';
import {
  constraintRect,
  cornerPath,
  createSvgNode,
  expandRect,
  intersectionRect,
  minRectSize,
  moveRect,
  rectContainsPoint,
  setSvgNodeAttrs,
  sidePath,
  thumbCursor,
} from './crop-utils.js';
import {
  GUIDE_STROKE_WIDTH,
  GUIDE_THIRD,
  MIN_CROP_SIZE,
  THUMB_CORNER_SIZE,
  THUMB_OFFSET,
  THUMB_STROKE_WIDTH,
} from './cropper-constants.js';
import { classNames } from './lib/classNames.js';

export class CropFrame extends Block {
  init$ = {
    ...this.init$,
    dragging: false,
  };

  constructor() {
    super();

    /** @private */
    this._handlePointerUp = this._handlePointerUp_.bind(this);

    /** @private */
    this._handlePointerMove = this._handlePointerMove_.bind(this);

    /** @private */
    this._handleSvgPointerMove = this._handleSvgPointerMove_.bind(this);
  }

  _shouldThumbBeDisabled(direction) {
    let imageBox = this.$['*imageBox'];
    if (!imageBox) {
      return;
    }

    if (direction === '' && imageBox.height <= MIN_CROP_SIZE && imageBox.width <= MIN_CROP_SIZE) {
      return true;
    }

    let tooHigh = imageBox.height <= MIN_CROP_SIZE && (direction.includes('n') || direction.includes('s'));
    let tooWide = imageBox.width <= MIN_CROP_SIZE && (direction.includes('e') || direction.includes('w'));
    return tooHigh || tooWide;
  }

  _createBackdrop() {
    /** @type {import('./types.js').Rectangle} */
    let cropBox = this.$['*cropBox'];
    if (!cropBox) {
      return;
    }
    let { x, y, width, height } = cropBox;
    let svg = this.ref['svg-el'];

    let mask = createSvgNode('mask', { id: 'backdrop-mask' });
    let maskRectOuter = createSvgNode('rect', {
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      fill: 'white',
    });
    let maskRectInner = createSvgNode('rect', {
      x,
      y,
      width,
      height,
      fill: 'black',
    });
    mask.appendChild(maskRectOuter);
    mask.appendChild(maskRectInner);

    let backdropRect = createSvgNode('rect', {
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

  /** Super tricky workaround for the chromium bug See https://bugs.chromium.org/p/chromium/issues/detail?id=330815 */
  _resizeBackdrop() {
    if (!this._backdropMask) {
      return;
    }
    this._backdropMask.style.display = 'none';
    window.requestAnimationFrame(() => {
      this._backdropMask.style.display = 'block';
    });
  }

  _updateBackdrop() {
    /** @type {import('./types.js').Rectangle} */
    let cropBox = this.$['*cropBox'];
    if (!cropBox) {
      return;
    }
    let { x, y, width, height } = cropBox;

    setSvgNodeAttrs(this._backdropMaskInner, { x, y, width, height });
  }

  _updateFrame() {
    /** @type {import('./types.js').Rectangle} */
    let cropBox = this.$['*cropBox'];
    if (!cropBox) {
      return;
    }
    for (let thumb of Object.values(this._frameThumbs)) {
      let { direction, pathNode, interactionNode, groupNode } = thumb;
      let isCenter = direction === '';
      let isCorner = direction.length === 2;

      if (isCenter) {
        let { x, y, width, height } = cropBox;
        let center = [x + width / 2, y + height / 2];
        setSvgNodeAttrs(interactionNode, {
          r: Math.min(width, height) / 3,
          cx: center[0],
          cy: center[1],
        });
      } else {
        let { d, center } = isCorner ? cornerPath(cropBox, direction) : sidePath(cropBox, direction);
        setSvgNodeAttrs(interactionNode, { cx: center[0], cy: center[1] });
        setSvgNodeAttrs(pathNode, { d });
      }

      let disableThumb = this._shouldThumbBeDisabled(direction);
      groupNode.setAttribute(
        'class',
        classNames('thumb', {
          'thumb--hidden': disableThumb,
          'thumb--visible': !disableThumb,
        })
      );
    }

    let frameGuides = this._frameGuides;
    setSvgNodeAttrs(frameGuides, {
      x: cropBox.x - GUIDE_STROKE_WIDTH * 0.5,
      y: cropBox.y - GUIDE_STROKE_WIDTH * 0.5,
      width: cropBox.width + GUIDE_STROKE_WIDTH,
      height: cropBox.height + GUIDE_STROKE_WIDTH,
    });
  }

  _createThumbs() {
    let frameThumbs = {};

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let direction = `${['n', '', 's'][i]}${['w', '', 'e'][j]}`;
        let groupNode = createSvgNode('g');
        groupNode.classList.add('thumb');
        groupNode.setAttribute('with-effects', '');
        let interactionNode = createSvgNode('circle', {
          r: THUMB_CORNER_SIZE + THUMB_OFFSET,
          fill: 'transparent',
        });
        let pathNode = createSvgNode('path', {
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

  _createGuides() {
    let svg = createSvgNode('svg');

    let rect = createSvgNode('rect', {
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      fill: 'none',
      stroke: '#000000',
      'stroke-width': GUIDE_STROKE_WIDTH,
      'stroke-opacity': 0.5,
    });
    svg.appendChild(rect);

    for (let i = 1; i <= 2; i++) {
      let line = createSvgNode('line', {
        x1: `${GUIDE_THIRD * i}%`,
        y1: `0%`,
        x2: `${GUIDE_THIRD * i}%`,
        y2: `100%`,
        stroke: '#000000',
        'stroke-width': GUIDE_STROKE_WIDTH,
        'stroke-opacity': 0.3,
      });
      svg.appendChild(line);
    }

    for (let i = 1; i <= 2; i++) {
      let line = createSvgNode('line', {
        x1: `0%`,
        y1: `${GUIDE_THIRD * i}%`,
        x2: `100%`,
        y2: `${GUIDE_THIRD * i}%`,
        stroke: '#000000',
        'stroke-width': GUIDE_STROKE_WIDTH,
        'stroke-opacity': 0.3,
      });
      svg.appendChild(line);
    }

    svg.classList.add('guides', 'guides--semi-hidden');

    return svg;
  }

  _createFrame() {
    let svg = this.ref['svg-el'];
    let fr = document.createDocumentFragment();

    let frameGuides = this._createGuides();
    fr.appendChild(frameGuides);

    let frameThumbs = this._createThumbs();
    for (let { groupNode } of Object.values(frameThumbs)) {
      fr.appendChild(groupNode);
    }

    svg.appendChild(fr);
    this._frameThumbs = frameThumbs;
    this._frameGuides = frameGuides;
  }

  _handlePointerDown(direction, e) {
    let thumb = this._frameThumbs[direction];
    if (this._shouldThumbBeDisabled(direction)) {
      return;
    }

    let cropBox = this.$['*cropBox'];
    let { x: svgX, y: svgY } = this.ref['svg-el'].getBoundingClientRect();
    let x = e.x - svgX;
    let y = e.y - svgY;

    this.$.dragging = true;
    this._draggingThumb = thumb;
    this._dragStartPoint = [x, y];
    /** @type {import('./types.js').Rectangle} */
    this._dragStartCrop = { ...cropBox };
  }

  _handlePointerUp_(e) {
    this._updateCursor();

    if (!this.$.dragging) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    this.$.dragging = false;
  }

  _handlePointerMove_(e) {
    if (!this.$.dragging) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    let svg = this.ref['svg-el'];
    let { x: svgX, y: svgY } = svg.getBoundingClientRect();
    let x = e.x - svgX;
    let y = e.y - svgY;
    let dx = x - this._dragStartPoint[0];
    let dy = y - this._dragStartPoint[1];
    let { direction } = this._draggingThumb;

    /** @type {import('./types.js').Rectangle} */
    let imageBox = this.$['*imageBox'];
    let rect = this._dragStartCrop;

    if (direction === '') {
      rect = moveRect(rect, [dx, dy]);
      rect = constraintRect(rect, imageBox);
    } else {
      rect = expandRect(rect, [dx, dy], direction);
      rect = intersectionRect(rect, imageBox);
    }
    /** @type {[Number, Number]} */
    let minCropRect = [Math.min(imageBox.width, MIN_CROP_SIZE), Math.min(imageBox.height, MIN_CROP_SIZE)];
    rect = minRectSize(rect, minCropRect, direction);

    if (!Object.values(rect).every((number) => Number.isFinite(number) && number >= 0)) {
      console.error('CropFrame is trying to create invalid rectangle', {
        payload: rect,
      });
      return;
    }
    this.$['*cropBox'] = rect;
  }

  _handleSvgPointerMove_(e) {
    let hoverThumb = Object.values(this._frameThumbs).find((thumb) => {
      if (this._shouldThumbBeDisabled(thumb.direction)) {
        return false;
      }
      let node = thumb.groupNode;
      let bounds = node.getBoundingClientRect();
      let rect = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
      let hover = rectContainsPoint(rect, [e.x, e.y]);
      return hover;
    });

    this._hoverThumb = hoverThumb;
    this._updateCursor();
  }

  _updateCursor() {
    let hoverThumb = this._hoverThumb;
    this.ref['svg-el'].style.cursor = hoverThumb ? thumbCursor(hoverThumb.direction) : 'initial';
  }

  _render() {
    this._updateBackdrop();
    this._updateFrame();
  }

  toggleThumbs(visible) {
    Object.values(this._frameThumbs)
      .map(({ groupNode }) => groupNode)
      .forEach((groupNode) => {
        groupNode.setAttribute(
          'class',
          classNames('thumb', {
            'thumb--hidden': !visible,
            'thumb--visible': visible,
          })
        );
      });
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
      this._frameGuides.setAttribute(
        'class',
        classNames({
          'guides--hidden': this._guidesHidden,
          'guides--visible': !this._guidesHidden && dragging,
          'guides--semi-hidden': !this._guidesHidden && !dragging,
        })
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

CropFrame.template = /*html*/ `
  <svg class='svg' ref='svg-el' xmlns="http://www.w3.org/2000/svg">
  </svg>
`;
