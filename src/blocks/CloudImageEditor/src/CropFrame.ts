import type { PropertyValues, TemplateResult } from 'lit';
import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { LitBlock } from '../../../lit/LitBlock';
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
import type { CropAspectRatio, Direction, FrameThumbs, Rectangle } from './types';

type FrameThumb = NonNullable<FrameThumbs[Direction]>;

type Delta = [number, number];

export class CropFrame extends LitBlock {
  private _backdropMask?: SVGMaskElement;
  private _backdropMaskInner?: SVGRectElement;
  private _frameThumbs?: FrameThumbs;
  private _frameGuides?: SVGElement;
  private _draggingThumb?: FrameThumb;
  private _hoverThumb?: FrameThumb;
  private _dragStartPoint?: Delta;
  private _dragStartCrop?: Rectangle;
  private _frameImage?: SVGImageElement;
  private _guidesHidden = false;
  @state()
  private _dragging = false;
  private readonly svgRef = createRef<SVGSVGElement>();
  private _svgReady = false;
  private _pendingMaskHref: string | null = null;

  private get _svgElement(): SVGSVGElement | null {
    return this.svgRef.value ?? null;
  }

  private get dragging(): boolean {
    return this._dragging;
  }

  private set dragging(value: boolean) {
    if (this._dragging === value) {
      return;
    }
    this._dragging = value;
    this._applyGuidesDragState();
  }

  private _applyGuidesDragState(): void {
    if (!this._frameGuides) {
      return;
    }
    this._frameGuides.setAttribute(
      'class',
      classNames({
        'uc-guides--hidden': this._guidesHidden,
        'uc-guides--visible': !this._guidesHidden && this._dragging,
        'uc-guides--semi-hidden': !this._guidesHidden && !this._dragging,
      }),
    );
  }

  private _shouldThumbBeDisabled(direction: Direction): boolean {
    const imageBox = this.$['*imageBox'] as Rectangle | undefined;
    if (!imageBox) {
      return false;
    }

    if (direction === '' && imageBox.height <= MIN_CROP_SIZE && imageBox.width <= MIN_CROP_SIZE) {
      return true;
    }

    const tooHigh = imageBox.height <= MIN_CROP_SIZE && (direction.includes('n') || direction.includes('s'));
    const tooWide = imageBox.width <= MIN_CROP_SIZE && (direction.includes('e') || direction.includes('w'));
    return tooHigh || tooWide;
  }

  private _createBackdrop(): void {
    const cropBox = this.$['*cropBox'] as Rectangle | undefined;
    if (!cropBox) {
      return;
    }
    const { x, y, width, height } = cropBox;
    const svg = this._svgElement;
    if (!svg) {
      return;
    }

    const mask = createSvgNode('mask', { id: 'backdrop-mask' }) as SVGMaskElement;
    const maskRectOuter = createSvgNode('rect', {
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      fill: 'white',
    }) as SVGRectElement;
    const maskRectInner = createSvgNode('rect', {
      x,
      y,
      width,
      height,
      fill: 'black',
    }) as SVGRectElement;
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
  private _resizeBackdrop(): void {
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

  private _updateBackdrop(): void {
    const cropBox = this.$['*cropBox'] as Rectangle | undefined;
    if (!cropBox) {
      return;
    }
    const { x, y, width, height } = cropBox;

    this._backdropMaskInner && setSvgNodeAttrs(this._backdropMaskInner, { x, y, width, height });
  }

  private _updateFrame(): void {
    const cropBox = this.$['*cropBox'] as Rectangle | undefined;

    if (!cropBox || !this._frameGuides || !this._frameThumbs) {
      return;
    }
    for (const thumb of Object.values(this._frameThumbs)) {
      if (!thumb) {
        continue;
      }
      const { direction, pathNode, interactionNode, groupNode } = thumb;
      const isCenter = direction === '';
      const isCorner = direction.length === 2;
      const { x, y, width, height } = cropBox;

      if (isCenter) {
        const moveThumbRect = {
          x,
          y,
          width,
          height,
        };
        setSvgNodeAttrs(interactionNode, moveThumbRect);
      } else {
        const thumbSizeMultiplier = clamp(
          Math.min(width, height) / (THUMB_CORNER_SIZE * 2 + THUMB_SIDE_SIZE) / 2,
          0,
          1,
        );

        const pathInfo = isCorner
          ? cornerPath(cropBox, direction, thumbSizeMultiplier)
          : sidePath(cropBox, direction as Extract<Direction, 'n' | 's' | 'e' | 'w'>, thumbSizeMultiplier);
        const center = pathInfo.center as [number, number] | undefined;
        if (!center) {
          continue;
        }
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
        setSvgNodeAttrs(pathNode, { d: pathInfo.d as string });
      }

      const disableThumb = this._shouldThumbBeDisabled(direction);
      groupNode.setAttribute(
        'class',
        classNames('uc-thumb', {
          'uc-thumb--hidden': disableThumb,
          'uc-thumb--visible': !disableThumb,
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

  private _createThumb(frameThumbs: FrameThumbs, direction: Direction): void {
    const groupNode = createSvgNode('g');
    groupNode.classList.add('uc-thumb');
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

    if (direction === '') {
      groupNode.style.cursor = 'move';
    }

    interactionNode.addEventListener('pointerdown', this._handlePointerDown.bind(this, direction));
  }

  private _createThumbs(): FrameThumbs {
    const frameThumbs: FrameThumbs = {};

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const direction = `${['n', '', 's'][i]}${['w', '', 'e'][j]}` as Direction;
        if (direction === '') {
          continue;
        }

        this._createThumb(frameThumbs, direction);
      }
    }

    this._createThumb(frameThumbs, '');
    return frameThumbs;
  }

  private _createGuides(): SVGElement {
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
        y1: `0%`,
        x2: `${GUIDE_THIRD * i}%`,
        y2: `100%`,
        stroke: 'currentColor',
        'stroke-width': GUIDE_STROKE_WIDTH,
        'stroke-opacity': 0.3,
      });
      svg.appendChild(line);
    }

    for (let i = 1; i <= 2; i++) {
      const line = createSvgNode('line', {
        x1: `0%`,
        y1: `${GUIDE_THIRD * i}%`,
        x2: `100%`,
        y2: `${GUIDE_THIRD * i}%`,
        stroke: 'currentColor',
        'stroke-width': GUIDE_STROKE_WIDTH,
        'stroke-opacity': 0.3,
      });
      svg.appendChild(line);
    }

    svg.classList.add('uc-guides', 'uc-guides--semi-hidden');

    return svg;
  }

  private _createFrame(): void {
    const svg = this._svgElement;
    if (!svg) {
      return;
    }
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
    this._applyGuidesDragState();
  }

  private _handlePointerDown(direction: Direction, e: PointerEvent): void {
    if (!this._frameThumbs) return;
    const thumb = this._frameThumbs[direction];
    if (!thumb) {
      return;
    }
    if (this._shouldThumbBeDisabled(direction)) {
      return;
    }

    const cropBox = this.$['*cropBox'] as Rectangle;
    const svgElement = this._svgElement;
    if (!svgElement) {
      return;
    }
    const { x: svgX, y: svgY } = svgElement.getBoundingClientRect();
    const x = e.x - svgX;
    const y = e.y - svgY;

    this.dragging = true;
    this._draggingThumb = thumb;
    this._dragStartPoint = [x, y];
    this._dragStartCrop = { ...cropBox };
  }

  private readonly _handlePointerUp = (e: PointerEvent): void => {
    this._updateCursor();

    if (!this.dragging) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    this.dragging = false;
  };

  private readonly _handlePointerMove = (e: PointerEvent): void => {
    if (!this.dragging || !this._dragStartPoint || !this._draggingThumb) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    const svg = this._svgElement;
    if (!svg) {
      return;
    }
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
  };

  private _calcCropBox(direction: Direction, delta: Delta): Rectangle | undefined {
    const [dx, dy] = delta;
    const imageBox = this.$['*imageBox'] as Rectangle;
    let rect = this._dragStartCrop ?? (this.$['*cropBox'] as Rectangle);

    const cropPreset = this.$['*currentAspectRatio'] as CropAspectRatio | null;
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
    return constraintRect(roundRect(rect), imageBox);
  }

  private readonly _handleSvgPointerMove = (e: PointerEvent): void => {
    if (!this._frameThumbs) return;

    const hoverThumb = Object.values(this._frameThumbs).find((thumb) => {
      if (!thumb) {
        return false;
      }
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

    this._hoverThumb = hoverThumb as FrameThumb | undefined;
    this._updateCursor();
  };

  private _updateCursor(): void {
    const hoverThumb = this._hoverThumb;
    const svg = this._svgElement;
    if (!svg) {
      return;
    }
    svg.style.cursor = hoverThumb ? thumbCursor(hoverThumb.direction) : 'initial';
  }

  private _createMask(href: string): void {
    if (this._frameImage) {
      this._frameImage.setAttribute('href', href);
      return;
    }

    const svg = this._svgElement;
    if (!svg) {
      this._pendingMaskHref = href;
      return;
    }
    this._pendingMaskHref = null;
    const fr = document.createDocumentFragment();

    const imageNode = createSvgNode('image', {
      href,
    }) as SVGImageElement;

    imageNode.setAttribute('class', 'uc-cloud-mask');

    fr.appendChild(imageNode);

    svg.appendChild(fr);

    this._frameImage = imageNode;
  }

  private _updateMask(): void {
    const cropBox = this.$['*cropBox'] as Rectangle | undefined;

    if (!cropBox || !this._frameImage) {
      return;
    }

    const { x, y, width, height } = cropBox;

    setSvgNodeAttrs(this._frameImage, {
      x,
      y,
      height,
      width,
    });
  }

  private _render(): void {
    if (!this._svgReady) {
      return;
    }
    this._updateBackdrop();
    this._updateFrame();
    this._updateMask();
  }

  toggleThumbs(visible: boolean): void {
    if (!this._frameThumbs) return;
    for (const thumb of Object.values(this._frameThumbs)) {
      if (!thumb) {
        continue;
      }
      const { groupNode } = thumb;
      groupNode.setAttribute(
        'class',
        classNames('uc-thumb', {
          'uc-thumb--hidden': !visible,
          'uc-thumb--visible': visible,
        }),
      );
    }
  }

  override initCallback(): void {
    super.initCallback();

    this.sub('*imageBox', () => {
      this._resizeBackdrop();
      if (!this._svgReady) {
        return;
      }
      window.requestAnimationFrame(() => {
        this._render();
      });
    });

    this.sub('*cropBox', (cropBox: Rectangle | undefined) => {
      if (!cropBox) {
        return;
      }
      this._guidesHidden = cropBox.height <= MIN_CROP_SIZE || cropBox.width <= MIN_CROP_SIZE;
      this._applyGuidesDragState();
      if (!this._svgReady) {
        return;
      }
      window.requestAnimationFrame(() => {
        this._render();
      });
    });

    this.subConfigValue('cloudImageEditorMaskHref', (maskHref: string | null) => {
      if (maskHref) {
        this._createMask(maskHref);
      }
    });

    document.addEventListener('pointermove', this._handlePointerMove, true);
    document.addEventListener('pointerup', this._handlePointerUp, true);
  }

  protected override firstUpdated(_changedProperties: PropertyValues<this>): void {
    super.firstUpdated(_changedProperties);
    this._initializeSvg();
  }

  private _initializeSvg(): void {
    const svg = this._svgElement;
    if (!svg || this._svgReady) {
      return;
    }
    this._createBackdrop();
    this._createFrame();
    this._svgReady = true;
    svg.addEventListener('pointermove', this._handleSvgPointerMove, true);

    if (this._pendingMaskHref) {
      const pendingMask = this._pendingMaskHref;
      this._pendingMaskHref = null;
      this._createMask(pendingMask);
    }

    this._render();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    const svg = this._svgElement;
    svg?.removeEventListener('pointermove', this._handleSvgPointerMove, true);
    document.removeEventListener('pointermove', this._handlePointerMove, true);
    document.removeEventListener('pointerup', this._handlePointerUp, true);
  }

  override render(): TemplateResult {
    return html`<svg class="uc-svg" xmlns="http://www.w3.org/2000/svg" ${ref(this.svgRef)}></svg>`;
  }
}
