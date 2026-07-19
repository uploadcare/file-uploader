import type { PropertyValues, TemplateResult } from 'lit';
import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import type { CloudImageEditorController } from '../../../abstract/controllers/CloudImageEditorController';
import { debounce } from '../../../utils/debounce.js';
import { preloadImage } from '../../../utils/preloadImage.js';
import { throttle } from '../../../utils/throttle.js';
import type { CropBoxChangeEvent, CropFrame } from './CropFrame';
import {
  clamp,
  constraintRect,
  isRectInsideRect,
  isRectMatchesAspectRatio,
  rotateSize,
  roundRect,
} from './crop-utils.js';
import { CROP_PADDING } from './cropper-constants.js';
import { EditorBlock } from './editor-context';
import { classNames } from './lib/classNames.js';
import { pick } from './lib/pick.js';
import { TabId } from './toolbar-constants';
import type { CropAspectRatio, ImageSize, Rectangle, Transformations } from './types';
import { viewerImageSrc } from './util.js';

import './CropFrame';

type CropTransform = NonNullable<Transformations['crop']>;

type Operations = {
  flip: boolean;
  mirror: boolean;
  rotate: number;
};

const OPERATION_KEYS = ['rotate', 'mirror', 'flip'] as const satisfies readonly (keyof Operations)[];
const DEFAULT_OPERATIONS: Readonly<Operations> = { rotate: 0, mirror: false, flip: false };

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

export class EditorImageCropper extends EditorBlock {
  private readonly _padding = CROP_PADDING;

  // Cropper-subtree-local state (M12 step 2a): only this element + `CropFrame`
  // read these, so they live as plain Lit state instead of the shared ctx /
  // editor controller. `_imageBox`/`_cropBox` are passed down to `CropFrame`
  // as reactive props (`.imageBox`/`.cropBox`); `CropFrame` reports drag
  // changes back up via a `cropboxchange` event (see `_handleCropBoxChange`).
  @state()
  private _operations: Operations = { ...DEFAULT_OPERATIONS };

  @state()
  private _imageBox: Rectangle = { x: 0, y: 0, width: 0, height: 0 };

  @state()
  private _cropBox: Rectangle = { x: 0, y: 0, width: 0, height: 0 };

  private _lastImageBox: Rectangle = this._imageBox;
  private _lastCropBox: Rectangle = this._cropBox;

  // Last-observed cross-cutting values read through the (coarse) editor
  // controller subscribe — used to detect an actual change of a specific key
  // among the many the controller's `subscribe` fires for (it notifies on
  // ANY cross-cutting state change, not per-key like the old shared-ctx
  // `sub(key, cb)`).
  private _lastAspectRatio: CropAspectRatio | null = null;
  private _lastNetworkProblems = false;
  private _lastOriginalUrl: string | null = null;
  // Guards the coarse `subscribeEditor` reaction against re-entering itself: it
  // writes state (`_commit`, `deactivate`→`_commit`) and `StateController.set`
  // notifies synchronously, so without this a commit would re-fire the reaction
  // (e.g. deactivate commits before flipping `_isActive`, recursing forever).
  private _reacting = false;
  // Bumped on every deactivate (incl. the new-image reset). A fire-and-forget
  // `activate()` captures the value at its start and bails after each `await` if
  // it no longer matches, so a stale image load can't finish over a newer one.
  private _activationGeneration = 0;

  /**
   * Loaded image size, passed down from the root (`<uc-cloud-image-editor>`) as
   * a plain Lit prop — it's DOM-derived, not editor-controller state. The
   * cropper self-activates once this and `*originalUrl` are ready on the crop
   * tab (see `_syncActivation`), so no external code drives `.activate()`.
   */
  @property({ attribute: false })
  public imageSize: ImageSize | null = null;

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

  private readonly _handleCropBoxChange = (e: CropBoxChangeEvent): void => {
    this._cropBox = e.detail;
  };

  public constructor() {
    super();

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

    // Controller-dependent setup (mirrors `ChildBlock.controllerReady` /
    // `initCallback` from the v1 base): runs immediately if the editor
    // controller is already adopted, and again on every later (re)attach.
    this.onEditorAttach(() => {
      this._lastAspectRatio = this.editorController.get('*currentAspectRatio');
      this._lastNetworkProblems = this.editorController.get('*networkProblems');
      this._lastOriginalUrl = this.editorController.get('*originalUrl');

      this.subscribeEditor(() => {
        if (this._reacting) {
          return;
        }
        this._reacting = true;
        try {
          const aspectRatio = this.editorController.get('*currentAspectRatio');
          if (aspectRatio !== this._lastAspectRatio) {
            this._lastAspectRatio = aspectRatio;
            this._alignCrop();
          }
          this._lastNetworkProblems = this.editorController.get('*networkProblems');

          // A new image (originalUrl change) invalidates the current crop.
          // Reset the ops to a clean slate and stay INACTIVE until the root
          // supplies the new image's `imageSize` prop — reactivation then
          // happens in `updated`. Reactivating here would use the previous
          // image's still-stale `imageSize` (the root clears it to null before
          // the size fetch). `deactivate` also bumps the activation generation,
          // aborting any in-flight activation of the old image.
          const originalUrl = this.editorController.get('*originalUrl');
          if (originalUrl !== this._lastOriginalUrl) {
            this._lastOriginalUrl = originalUrl;
            this._operations = { ...DEFAULT_OPERATIONS };
            if (this._isActive) {
              this.deactivate({ reset: true });
            }
            return;
          }

          // Self-activate/deactivate from controller state + the imageSize prop
          // (replaces the root/toolbar calling `.activate()`/`.deactivate()`).
          this._syncActivation();

          // Crop ops (rotate/flip/mirror) now arrive through
          // `*editorTransformations` — `EditorCropButtonControl` writes them
          // instead of calling `setValue`. Apply + re-commit the consistent
          // crop; the re-entrancy guard swallows our own commit's notify.
          if (this._isActive && this._cropOpsDiffer(this.editorController.get('*editorTransformations'))) {
            this._syncTransformations();
            this._alignImage();
            this._alignCrop();
            this._draw();
            this._commit();
          }
        } finally {
          this._reacting = false;
        }
      });
    });
  }

  protected override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    this._initCanvas();
  }

  private _syncTransformations(): void {
    const transformations = this.editorController.get('*editorTransformations');
    const pickedTransformations = pick(transformations, OPERATION_KEYS) as Partial<Operations>;
    const operations: Operations = { ...this._operations, ...pickedTransformations };
    this._operations = operations;
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
    const padding = this._padding;
    const operations = this._operations;
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

    this._imageBox = roundRect(imageBox);
  }

  private _alignCrop(): void {
    let cropBox = this._cropBox;
    const imageBox = this._imageBox;
    const operations = this._operations;
    const { rotate } = operations;
    const cropTransformation = this.editorController.get('*editorTransformations').crop;
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

    const cropPreset = this.editorController.get('*currentAspectRatio');
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

    this._cropBox = constraintRect(roundRect(cropBox), imageBox);
  }

  private _drawImage(): void {
    const ctx = this._ctx;
    if (!ctx) return;
    const image = this._image;
    if (!image) {
      return;
    }
    const imageBox = this._imageBox;
    const operations = this._operations;
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
    const cropBox = this._cropBox;
    const imageBox = this._imageBox;
    const operations = this._operations;
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
    const cropBox = this._cropBox;
    const imageBox = this._imageBox;
    const operations = this._operations;
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
      this._log.error('Cropper is trying to create invalid crop object', {
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
    const operations = this._operations;
    const { rotate, mirror, flip } = operations;
    const crop = this._getCropTransformation();
    const editorTransformations = this.editorController.get('*editorTransformations');
    const transformations: Transformations = {
      ...editorTransformations,
      crop,
      rotate,
      mirror,
      flip,
    };

    this.editorController.set('*editorTransformations', transformations);
  }

  /** True when the committed crop ops differ from what the cropper has applied. */
  private _cropOpsDiffer(transformations: Transformations): boolean {
    return OPERATION_KEYS.some((key) => (transformations[key] ?? DEFAULT_OPERATIONS[key]) !== this._operations[key]);
  }

  /** Activate on the crop tab once the image + its size are ready; deactivate (committing) otherwise. */
  private _syncActivation(): void {
    const controller = this.editorControllerOrNull;
    if (!controller) {
      return;
    }
    const shouldBeActive =
      controller.get('*tabId') === TabId.CROP &&
      !!this.imageSize &&
      !!controller.get('*originalUrl') &&
      !controller.get('*networkProblems');

    if (shouldBeActive && !this._isActive) {
      void this.activate(this.imageSize as ImageSize);
    } else if (!shouldBeActive && this._isActive) {
      this.deactivate();
    }
  }

  public async activate(imageSize: ImageSize, { fromViewer }: { fromViewer?: boolean } = {}): Promise<void> {
    if (this._isActive) {
      return;
    }
    this._isActive = true;
    // Snapshot the generation: a deactivate/new-image reset during the awaits
    // below bumps it, so this fire-and-forget activation aborts instead of
    // drawing a superseded image (see `_activationGeneration`).
    const generation = this._activationGeneration;
    await this.updateComplete;
    if (!this.isConnected || generation !== this._activationGeneration) {
      return;
    }
    this._initCanvas();
    this._imageSize = imageSize;
    this.removeEventListener('transitionend', this._reset);

    try {
      // Capture the controller instance once (rather than re-reading the
      // `editorController` accessor after each `await`): the accessor throws
      // once this element disconnects (the editor context tears down its
      // adopted controller on `hostDisconnected`), but the captured instance
      // itself stays a valid, usable object — mirroring how the old
      // shared-ctx `this.$` kept working across a disconnect.
      const controller = this.editorControllerOrNull;
      if (!controller) {
        return;
      }
      const originalUrl = controller.get('*originalUrl') as string;
      const transformations = controller.get('*editorTransformations');
      this._image = await this._waitForImage(controller, originalUrl, transformations);
      if (!this.isConnected || generation !== this._activationGeneration) {
        return;
      }
      this._syncTransformations();
      this._handleResizeThrottled();
      this._animateIn({ fromViewer });
    } catch (err) {
      this._log.error('Failed to activate cropper', { error: err });
      this.editorControllerOrNull?.telemetry.sendEventError(err, 'cloud editor image. Failed to activate cropper');
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
    // Invalidate any in-flight `activate()` (see `_activationGeneration`).
    this._activationGeneration += 1;
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
    const cropBox = this._cropBox;
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
    const cropBox = this._cropBox;
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

  private async _waitForImage(
    controller: CloudImageEditorController,
    originalUrl: string,
    transformations: Transformations,
  ): Promise<HTMLImageElement> {
    const width = this.offsetWidth;
    transformations = {
      ...transformations,
      crop: undefined,
      rotate: undefined,
      flip: undefined,
      mirror: undefined,
    };
    const src = await controller.proxyUrl(viewerImageSrc(originalUrl, width, transformations));
    const { promise, cancel, image } = preloadImage(src);

    const stop = this._handleImageLoading(controller, src);
    image.addEventListener('load', stop, { once: true });
    image.addEventListener('error', stop, { once: true });
    this._cancelPreload?.();
    this._cancelPreload = cancel;

    return promise
      .then(() => image)
      .catch((err) => {
        this._log.error('Failed to load image', { error: err });
        controller.set('*networkProblems', true);
        return image;
      });
  }

  private _handleImageLoading(controller: CloudImageEditorController, src: string): () => void {
    const operation = 'crop';
    // Immutable update: `StateController.set` dedupes by `Object.is`, so we must
    // publish a NEW Map reference (outer + inner) or subscribers never notify.
    const current = controller.get('*loadingOperations');
    if (!current.get(operation)?.get(src)) {
      const next = new Map(current);
      const operationMap = new Map(next.get(operation) ?? []);
      operationMap.set(src, true);
      next.set(operation, operationMap);
      controller.set('*loadingOperations', next);
    }

    return () => {
      const current = controller.get('*loadingOperations');
      const operationMap = current.get(operation);
      if (operationMap?.has(src)) {
        const next = new Map(current);
        const nextOperationMap = new Map(operationMap);
        nextOperationMap.delete(src);
        next.set(operation, nextOperationMap);
        controller.set('*loadingOperations', next);
      }
    };
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    // The `imageSize` prop is not controller state, so `subscribeEditor` never
    // fires for it — re-evaluate activation when the root updates it.
    if (changedProperties.has('imageSize')) {
      this._syncActivation();
    }

    // `_imageBox`/`_cropBox` are private state, so their literal names can't
    // be used with `changedProperties.has(...)` (that requires a `keyof
    // this` that survives declaration-bundling of private members — see the
    // `dts` build). Diff against the last-seen value instead; equivalent to
    // the old shared-ctx `sub('*imageBox'|'*cropBox', ...)` reactions.
    if (!Object.is(this._imageBox, this._lastImageBox)) {
      this._lastImageBox = this._imageBox;
      this._draw();
    }

    if (!Object.is(this._cropBox, this._lastCropBox)) {
      this._lastCropBox = this._cropBox;
      if (this._image) {
        this._commitDebounced();
      }
    }
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
      <uc-crop-frame
        ${ref(this._frameRef)}
        .imageBox=${this._imageBox}
        .cropBox=${this._cropBox}
        @uc-internal:cropboxchange=${this._handleCropBoxChange}
      ></uc-crop-frame>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-image-cropper': EditorImageCropper;
  }
}
