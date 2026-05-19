import type { PropertyValues, TemplateResult } from 'lit';
import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { LitBlock } from '../../../lit/LitBlock';
import { debounce } from '../../../utils/debounce.js';
import { preloadImage } from '../../../utils/preloadImage.js';
import { throttle } from '../../../utils/throttle.js';
import type { CropFrame } from './CropFrame';
import {
  clamp,
  constraintRect,
  isRectInsideRect,
  isRectMatchesAspectRatio,
  rotateSize,
  roundRect,
} from './crop-utils.js';
import { CROP_PADDING } from './cropper-constants.js';
import { classNames } from './lib/classNames.js';
import { pick } from './lib/pick.js';
import type { CropAspectRatio, ImageSize, LoadingOperations, Rectangle, Transformations } from './types';
import { viewerImageSrc } from './util.js';

import './CropFrame';

type CropTransform = NonNullable<Transformations['crop']>;

type Operations = {
  flip: boolean;
  mirror: boolean;
  rotate: number;
};

function validateCrop(crop: Transformations['crop']): boolean {
  if (!crop) {
    return true;
  }
  const shouldMatch: Array<(arg: CropTransform) => boolean> = [
    ({ dimensions, coords }) =>
      [...dimensions, ...coords].every((number) => Number.isInteger(number) && Number.isFinite(number)),
    ({ dimensions, coords }) => dimensions.every((d) => d > 0) && coords.every((c) => c >= 0),
  ];
  return shouldMatch.every((matcher) => matcher(crop));
}

export class EditorImageCropper extends LitBlock {
  public override ctxOwner = true;

  private _commitDebounced: ReturnType<typeof debounce>;
  private _handleResizeThrottled: ReturnType<typeof throttle>;
  private _imageSize: ImageSize = { width: 0, height: 0 };
  private _canvas?: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _isActive = false;
  private _observer?: ResizeObserver;
  @state()
  private _image: HTMLImageElement | null = null;
  private _cancelPreload?: () => void;
  private readonly _canvasRef = createRef<HTMLCanvasElement>();
  private readonly _frameRef = createRef<CropFrame>();

  public constructor() {
    super();

    this.init$ = {
      ...this.init$,
      '*padding': CROP_PADDING,
      '*operations': {
        rotate: 0,
        mirror: false,
        flip: false,
      },
      '*imageBox': {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
      '*cropBox': {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
    };

    this._commitDebounced = debounce(this._commit.bind(this), 300);

    this._handleResizeThrottled = throttle(() => {
      if (!this.isConnected || !this._isActive) {
        return;
      }
      this._initCanvas();
      this._syncTransformations();
      this._alignImage();
      this._alignCrop();
      this._draw();
    }, 100);
  }

  protected override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    this._initCanvas();
  }

  private _syncTransformations(): void {
    const transformations = this.$['*editorTransformations'] as Transformations;
    const pickedTransformations = pick(
      transformations,
      Object.keys(this.$['*operations']) as readonly (keyof Transformations)[],
    ) as Partial<Operations>;
    const operations: Operations = { ...this.$['*operations'], ...pickedTransformations };
    this.$['*operations'] = operations;
  }

  private _initCanvas(): void {
    const canvas = this._canvasRef.value;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');

    const width = this.offsetWidth;
    const height = this.offsetHeight;
    const dpr = window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx?.scale(dpr, dpr);

    this._canvas = canvas;
    this._ctx = ctx;
  }

  private _alignImage(): void {
    if (!this._isActive || !this._image) {
      return;
    }

    const image = this._image;
    const padding = this.$['*padding'] as number;
    const operations = this.$['*operations'] as Operations;
    const { rotate } = operations;

    const bounds = { width: this.offsetWidth, height: this.offsetHeight };
    const naturalSize = rotateSize({ width: image.naturalWidth, height: image.naturalHeight }, rotate);
    let imageBox: Rectangle;

    if (naturalSize.width > bounds.width - padding * 2 || naturalSize.height > bounds.height - padding * 2) {
      const imageAspectRatio = naturalSize.width / naturalSize.height;
      const viewportAspectRatio = bounds.width / bounds.height;

      if (imageAspectRatio > viewportAspectRatio) {
        const width = bounds.width - padding * 2;
        const height = width / imageAspectRatio;
        const x = 0 + padding;
        const y = padding + (bounds.height - padding * 2) / 2 - height / 2;
        imageBox = { x, y, width, height };
      } else {
        const height = bounds.height - padding * 2;
        const width = height * imageAspectRatio;
        const x = padding + (bounds.width - padding * 2) / 2 - width / 2;
        const y = 0 + padding;
        imageBox = { x, y, width, height };
      }
    } else {
      const { width, height } = naturalSize;
      const x = padding + (bounds.width - padding * 2) / 2 - width / 2;
      const y = padding + (bounds.height - padding * 2) / 2 - height / 2;
      imageBox = { x, y, width, height };
    }

    this.$['*imageBox'] = roundRect(imageBox);
  }

  private _alignCrop(): void {
    let cropBox = this.$['*cropBox'] as Rectangle;
    const imageBox = this.$['*imageBox'] as Rectangle;
    const operations = this.$['*operations'] as Operations;
    const { rotate } = operations;
    const cropTransformation = (this.$['*editorTransformations'] as Transformations).crop;
    const { width: previewWidth, x: previewX, y: previewY } = imageBox;

    if (cropTransformation) {
      const {
        dimensions: [width, height],
        coords: [x, y],
      } = cropTransformation;
      const { width: sourceWidth } = rotateSize(this._imageSize, rotate);
      const ratio = previewWidth / sourceWidth;
      cropBox = constraintRect(
        roundRect({
          x: previewX + x * ratio,
          y: previewY + y * ratio,
          width: width * ratio,
          height: height * ratio,
        }),
        imageBox,
      );
    }

    const cropPreset = this.$['*currentAspectRatio'] as CropAspectRatio | null;
    const cropAspectRatio = cropPreset ? cropPreset.width / cropPreset.height : undefined;

    if (
      !isRectInsideRect(cropBox, imageBox) ||
      (cropAspectRatio && !isRectMatchesAspectRatio(cropBox, cropAspectRatio))
    ) {
      const imageAspectRatio = imageBox.width / imageBox.height;
      let width = imageBox.width;
      let height = imageBox.height;
      if (cropAspectRatio) {
        if (imageAspectRatio > cropAspectRatio) {
          width = Math.min(imageBox.height * cropAspectRatio, imageBox.width);
        } else {
          height = Math.min(imageBox.width / cropAspectRatio, imageBox.height);
        }
      }
      cropBox = {
        x: imageBox.x + imageBox.width / 2 - width / 2,
        y: imageBox.y + imageBox.height / 2 - height / 2,
        width,
        height,
      };
    }

    this.$['*cropBox'] = constraintRect(roundRect(cropBox), imageBox);
  }

  private _drawImage(): void {
    const ctx = this._ctx;
    if (!ctx) return;
    const image = this._image;
    if (!image) {
      return;
    }
    const imageBox = this.$['*imageBox'] as Rectangle;
    const operations = this.$['*operations'] as Operations;
    const { mirror, flip, rotate } = operations;
    const rotated = rotateSize({ width: imageBox.width, height: imageBox.height }, rotate);
    ctx.save();
    ctx.translate(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
    ctx.rotate((rotate * Math.PI * -1) / 180);
    ctx.scale(mirror ? -1 : 1, flip ? -1 : 1);
    ctx.drawImage(image, -rotated.width / 2, -rotated.height / 2, rotated.width, rotated.height);
    ctx.restore();
  }

  private _draw(): void {
    if (!this._isActive || !this._image || !this._canvas || !this._ctx) {
      return;
    }
    const canvas = this._canvas;
    const ctx = this._ctx;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this._drawImage();
  }

  private _animateIn({ fromViewer }: { fromViewer?: boolean }): void {
    if (this._image) {
      this._frameRef.value?.toggleThumbs(true);
      this._transitionToImage();
      setTimeout(() => {
        this.className = classNames({
          'uc-active_from_viewer': fromViewer,
          'uc-active_from_editor': !fromViewer,
          'uc-inactive_to_editor': false,
        });
      });
    }
  }

  private _getCropDimensions(): CropTransform['dimensions'] {
    const cropBox = this.$['*cropBox'] as Rectangle;
    const imageBox = this.$['*imageBox'] as Rectangle;
    const operations = this.$['*operations'] as Operations;
    const { rotate } = operations;
    const { width: previewWidth, height: previewHeight } = imageBox;
    const { width: sourceWidth, height: sourceHeight } = rotateSize(this._imageSize, rotate);
    const { width: cropWidth, height: cropHeight } = cropBox;
    const ratioW = previewWidth / sourceWidth;
    const ratioH = previewHeight / sourceHeight;

    const dimensions: CropTransform['dimensions'] = [
      clamp(Math.round(cropWidth / ratioW), 1, sourceWidth),
      clamp(Math.round(cropHeight / ratioH), 1, sourceHeight),
    ];

    return dimensions;
  }

  private _getCropTransformation(): Transformations['crop'] {
    const cropBox = this.$['*cropBox'] as Rectangle;
    const imageBox = this.$['*imageBox'] as Rectangle;
    const operations = this.$['*operations'] as Operations;
    const { rotate } = operations;
    const { width: previewWidth, height: previewHeight, x: previewX, y: previewY } = imageBox;
    const { width: sourceWidth, height: sourceHeight } = rotateSize(this._imageSize, rotate);
    const { x: cropX, y: cropY } = cropBox;
    const ratioW = previewWidth / sourceWidth;
    const ratioH = previewHeight / sourceHeight;

    const dimensions = this._getCropDimensions();
    const crop: CropTransform = {
      dimensions,
      coords: [
        clamp(Math.round((cropX - previewX) / ratioW), 0, sourceWidth - dimensions[0]),
        clamp(Math.round((cropY - previewY) / ratioH), 0, sourceHeight - dimensions[1]),
      ],
    };
    if (!validateCrop(crop)) {
      console.error('Cropper is trying to create invalid crop object', {
        payload: crop,
      });
      return undefined;
    }
    if (dimensions[0] === sourceWidth && dimensions[1] === sourceHeight) {
      return undefined;
    }

    return crop;
  }

  private _commit(): void {
    if (!this.isConnected || !this._imageSize) {
      return;
    }
    const operations = this.$['*operations'] as Operations;
    const { rotate, mirror, flip } = operations;
    const crop = this._getCropTransformation();
    const editorTransformations = this.$['*editorTransformations'] as Transformations;
    const transformations: Transformations = {
      ...editorTransformations,
      crop,
      rotate,
      mirror,
      flip,
    };

    this.$['*editorTransformations'] = transformations;
  }

  public setValue<K extends keyof Operations>(operation: K, value: Operations[K]): void {
    this.$['*operations'] = {
      ...this.$['*operations'],
      [operation]: value,
    };

    if (!this._isActive) {
      return;
    }

    this._alignImage();
    this._alignCrop();
    this._draw();
  }

  public getValue<K extends keyof Operations>(operation: K): Operations[K] {
    return this.$['*operations'][operation];
  }

  public async activate(imageSize: ImageSize, { fromViewer }: { fromViewer?: boolean } = {}): Promise<void> {
    if (this._isActive) {
      return;
    }
    this._isActive = true;
    await this.updateComplete;
    this._initCanvas();
    this._imageSize = imageSize;
    this.removeEventListener('transitionend', this._reset);

    try {
      const originalUrl = this.$['*originalUrl'] as string;
      const transformations = this.$['*editorTransformations'] as Transformations;
      this._image = await this._waitForImage(originalUrl, transformations);
      this._syncTransformations();
      this._handleResizeThrottled();
      this._animateIn({ fromViewer });
    } catch (err) {
      console.error('Failed to activate cropper', { error: err });
      this.telemetryManager.sendEventError(err, 'cloud editor image. Failed to activate cropper');
    }

    this._observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (!entry) {
        return;
      }
      const nonZeroSize = entry.contentRect.width > 0 && entry.contentRect.height > 0;
      if (nonZeroSize && this._isActive && this._image) {
        this._handleResizeThrottled();
      }
    });
    this._observer.observe(this);
  }
  public deactivate({ reset = false }: { reset?: boolean } = {}): void {
    if (!this._isActive) {
      return;
    }
    !reset && this._commit();
    this._isActive = false;

    this._transitionToCrop();

    this.className = classNames({
      'uc-active_from_viewer': false,
      'uc-active_from_editor': false,
      'uc-inactive_to_editor': true,
    });

    this._frameRef.value?.toggleThumbs(false);
    this.addEventListener('transitionend', this._reset, { once: true });
    this._observer?.disconnect();
  }

  private _transitionToCrop(): void {
    const dimensions = this._getCropDimensions();
    const cropBox = this.$['*cropBox'] as Rectangle;
    const scaleX = Math.min(this.offsetWidth, dimensions[0]) / cropBox.width;
    const scaleY = Math.min(this.offsetHeight, dimensions[1]) / cropBox.height;
    const scale = Math.min(scaleX, scaleY);
    const cropCenterX = cropBox.x + cropBox.width / 2;
    const cropCenterY = cropBox.y + cropBox.height / 2;

    this.style.transform = `scale(${scale}) translate(${(this.offsetWidth / 2 - cropCenterX) / scale}px, ${
      (this.offsetHeight / 2 - cropCenterY) / scale
    }px)`;
    this.style.transformOrigin = `${cropCenterX}px ${cropCenterY}px`;
  }

  private _transitionToImage(): void {
    const cropBox = this.$['*cropBox'] as Rectangle;
    const cropCenterX = cropBox.x + cropBox.width / 2;
    const cropCenterY = cropBox.y + cropBox.height / 2;

    this.style.transform = `scale(1)`;
    this.style.transformOrigin = `${cropCenterX}px ${cropCenterY}px`;
  }

  private _reset(): void {
    if (!this._isActive) {
      this._image = null;
    }
  }

  private async _waitForImage(originalUrl: string, transformations: Transformations): Promise<HTMLImageElement> {
    const width = this.offsetWidth;
    transformations = {
      ...transformations,
      crop: undefined,
      rotate: undefined,
      flip: undefined,
      mirror: undefined,
    };
    const src = await this.proxyUrl(viewerImageSrc(originalUrl, width, transformations));
    const { promise, cancel, image } = preloadImage(src);

    const stop = this._handleImageLoading(src);
    image.addEventListener('load', stop, { once: true });
    image.addEventListener('error', stop, { once: true });
    this._cancelPreload?.();
    this._cancelPreload = cancel;

    return promise
      .then(() => image)
      .catch((err) => {
        console.error('Failed to load image', { error: err });
        this.$['*networkProblems'] = true;
        return image;
      });
  }

  private _handleImageLoading(src: string): () => void {
    const operation = 'crop';
    const loadingOperations = this.$['*loadingOperations'] as LoadingOperations;
    let operationMap = loadingOperations.get(operation);
    if (!operationMap) {
      operationMap = new Map<string, boolean>();
      loadingOperations.set(operation, operationMap);
    }

    if (!operationMap.get(src)) {
      operationMap.set(src, true);
      this.$['*loadingOperations'] = loadingOperations;
    }

    return () => {
      const map = loadingOperations.get(operation);
      if (map?.has(src)) {
        map.delete(src);
        this.$['*loadingOperations'] = loadingOperations;
      }
    };
  }

  public override initCallback(): void {
    super.initCallback();

    this.sub('*imageBox', () => {
      this._draw();
    });

    this.sub('*cropBox', () => {
      if (this._image) {
        this._commitDebounced();
      }
    });

    this.sub('*currentAspectRatio', () => {
      this._alignCrop();
    });

    setTimeout(() => {
      this.sub('*networkProblems', (networkProblems: boolean) => {
        if (!networkProblems) {
          if (this._isActive && this._imageSize) {
            void this.activate(this._imageSize, { fromViewer: false });
          }
        }
      });
    }, 0);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._observer?.disconnect();
    if (this._image) {
      this._image = null;
    }
  }

  public override render(): TemplateResult {
    return html`
      <canvas class="uc-canvas" ${ref(this._canvasRef)}></canvas>
      <uc-crop-frame ${ref(this._frameRef)}></uc-crop-frame>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-image-cropper': EditorImageCropper;
  }
}
