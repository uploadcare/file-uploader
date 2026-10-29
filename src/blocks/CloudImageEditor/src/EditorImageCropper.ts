import type { PropertyValues, TemplateResult } from 'lit';
import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { isAbortError } from '../../../abstract/di/Lifetime';
import { debounced, throttled } from '../../../lit/rate-limited-method';
import { subscription, type Unsubscribe } from '../../../lit/subscription';
import { preloadImage } from '../../../utils/preloadImage.js';
import type { CloudImageEditorController } from './CloudImageEditorController';
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
import { applyClassNames } from './lib/classNames.js';
import { TabId } from './toolbar-constants';
import type { CropAspectRatio, ImageSize, Rectangle, Transformations } from './types';
import { cropperImageSrc, trackImageLoading } from './util.js';

import './CropFrame';

type CropTransform = NonNullable<Transformations['crop']>;

type Operations = {
  flip: boolean;
  mirror: boolean;
  rotate: number;
};

const OPERATION_KEYS = ['rotate', 'mirror', 'flip'] as const satisfies readonly (keyof Operations)[];
const DEFAULT_OPERATIONS: Readonly<Operations> = { rotate: 0, mirror: false, flip: false };

const isValidCrop = ({ dimensions, coords }: CropTransform): boolean =>
  dimensions.every((d) => Number.isInteger(d) && d > 0) && coords.every((c) => Number.isInteger(c) && c >= 0);

export class EditorImageCropper extends EditorBlock {
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

  // Last-seen values of the keys `_reactToState` acts on — it runs for a change
  // of any key it watches, so it diffs to tell which one changed.
  private _lastAspectRatio: CropAspectRatio | null = null;
  private _lastOriginalUrl: string | null = null;
  // Guards `_reactToState` against re-entering itself: it writes state
  // (`_commit`, `deactivate`→`_commit`) and a controller write notifies
  // observers synchronously, so without this a commit would re-fire the reaction
  // (e.g. deactivate commits before flipping `_isActive`, recursing forever).
  private _reacting = false;
  // One per `activate()`, aborted by `deactivate` (incl. the new-image reset): the
  // activation's image load stops, and it bails after each `await`, so a stale
  // image can't finish over a newer one.
  private _activation?: AbortController;

  /**
   * Loaded image size, passed down from the root (`<uc-cloud-image-editor>`) as
   * a plain Lit prop — it's DOM-derived, not editor-controller state. The
   * cropper self-activates once this and `originalUrl` are ready on the crop
   * tab (see `_syncActivation`), so no external code drives `.activate()`.
   */
  @property({ attribute: false })
  public imageSize: ImageSize | null = null;

  private _imageSize: ImageSize = { width: 0, height: 0 };
  private _canvas?: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _isActive = false;
  private _observer?: ResizeObserver;
  @state()
  private _image: HTMLImageElement | null = null;
  private readonly _canvasRef = createRef<HTMLCanvasElement>();
  private readonly _frameRef = createRef<CropFrame>();

  private readonly _handleCropBoxChange = (e: CropBoxChangeEvent): void => {
    this._cropBox = e.detail;
  };

  /**
   * Seeds what `_reactToState` diffs against, reconciles once — a (re)attach
   * can find the cropper ready to activate already, e.g. after an activation
   * aborted by a reconnect — then reconciles on every change of the state the
   * reaction reads or the activation it starts loads from.
   * @internal
   */
  @subscription()
  protected _watchState(): Unsubscribe[] {
    const controller = this.editorController;
    this._lastAspectRatio = controller.currentAspectRatio;
    this._lastOriginalUrl = controller.originalUrl;
    this._syncActivation();
    const react = () => this._reactToState();
    return (
      [
        'currentAspectRatio',
        'originalUrl',
        'tabId',
        'networkProblems',
        'editorTransformations',
        'sourceOperations',
      ] as const
    ).map((key) => controller.observe(key, react));
  }

  private _reactToState(): void {
    if (this._reacting) {
      return;
    }
    this._reacting = true;
    try {
      const aspectRatio = this.editorController.currentAspectRatio;
      if (aspectRatio !== this._lastAspectRatio) {
        this._lastAspectRatio = aspectRatio;
        this._alignCrop();
      }

      // A new image (originalUrl change) invalidates the current crop.
      // Reset the ops to a clean slate and stay INACTIVE until the root
      // supplies the new image's `imageSize` prop — reactivation then
      // happens in `updated`. Reactivating here would use the previous
      // image's still-stale `imageSize` (the root clears it to null before
      // the size fetch). `deactivate` also aborts the current activation, so an
      // in-flight activation of the old image stops.
      const originalUrl = this.editorController.originalUrl;
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
      // `editorTransformations` — `EditorCropButtonControl` writes them
      // instead of calling `setValue`. Apply + re-commit the consistent
      // crop; the re-entrancy guard swallows our own commit's notify.
      if (this._isActive && this._cropOpsDiffer(this.editorController.editorTransformations)) {
        this._syncTransformations();
        this._alignImage();
        this._alignCrop();
        this._draw();
        this._commit();
      }
    } finally {
      this._reacting = false;
    }
  }

  @debounced(300)
  private _commitDebounced(): void {
    this._commit();
  }

  @throttled(100)
  private _handleResizeThrottled(): void {
    if (!this._isActive) {
      return;
    }
    this._initCanvas();
    this._syncTransformations();
    this._alignImage();
    this._alignCrop();
    this._draw();
  }

  protected override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    this._initCanvas();
  }

  private _syncTransformations(): void {
    const transformations = this.editorController.editorTransformations;
    const {
      rotate = this._operations.rotate,
      mirror = this._operations.mirror,
      flip = this._operations.flip,
    } = transformations;
    this._operations = { rotate, mirror, flip };
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
    const padding = CROP_PADDING;
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
    const cropTransformation = this.editorController.editorTransformations.crop;
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

    const cropPreset = this.editorController.currentAspectRatio;
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

  private _draw(): void {
    const ctx = this._ctx;
    const image = this._image;
    const canvas = this._canvas;
    if (!this._isActive || !image || !canvas || !ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

  private _animateIn(): void {
    if (this._image) {
      this._frameRef.value?.toggleThumbs(true);
      this._transitionToImage();
      // A later task, so the browser styles the transform above before the class change starts the CSS transition.
      setTimeout(() => {
        applyClassNames(this, {
          'uc-active_from_editor': true,
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
    if (!isValidCrop(crop)) {
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
    // A box that was never laid out (0×0 — e.g. while the editor is detached mid-move) has no crop to read: the
    // preview/source ratio is 0 and the coordinates come out NaN, which would replace the current crop with none.
    if (!this._imageSize || !this._imageBox.width || !this._imageBox.height) {
      return;
    }
    const operations = this._operations;
    const { rotate, mirror, flip } = operations;
    const crop = this._getCropTransformation();
    const editorTransformations = this.editorController.editorTransformations;
    const transformations: Transformations = {
      ...editorTransformations,
      crop,
      rotate,
      mirror,
      flip,
    };

    this.editorController.editorTransformations = transformations;
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
      controller.tabId === TabId.CROP && !!this.imageSize && !!controller.originalUrl && !controller.networkProblems;

    if (shouldBeActive && !this._isActive) {
      const imageSize = this.imageSize as ImageSize;
      this.runTask(() => this.activate(imageSize));
    } else if (!shouldBeActive && this._isActive) {
      this.deactivate();
    }
  }

  public async activate(imageSize: ImageSize): Promise<void> {
    if (this._isActive || this.adoptionSignal.aborted) {
      return;
    }
    this._isActive = true;
    const activation = new AbortController();
    this._activation = activation;
    // Released before this activation finished (disconnect, controller swap): roll back right away, so the next
    // attach's `_syncActivation` activates again instead of seeing a cropper that never finished activating.
    const signal = this.adoptionSignal;
    const rollback = () => {
      if (!activation.signal.aborted) {
        this._isActive = false;
      }
    };
    signal.addEventListener('abort', rollback, { once: true });
    await this.whileAdopted(this.updateComplete);
    if (activation.signal.aborted) {
      return;
    }
    this._initCanvas();
    this._imageSize = imageSize;
    this.removeEventListener('transitionend', this._reset);

    try {
      const controller = this.editorController;
      const originalUrl = controller.originalUrl as string;
      const transformations = controller.editorTransformations;
      const image = await this._waitForImage(controller, originalUrl, transformations, activation.signal);
      // Deactivated while the image loaded: its image is not ours to keep.
      if (activation.signal.aborted) {
        return;
      }
      this._image = image;
      this._syncTransformations();
      this._handleResizeThrottled();
      this._animateIn();
    } catch (err) {
      if (isAbortError(err)) throw err;
      this._log.error('Failed to activate cropper', { error: err });
      this.editorController.telemetry.sendEventError(err, 'cloud editor image. Failed to activate cropper');
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
    signal.removeEventListener('abort', rollback);
  }
  public deactivate({ reset = false }: { reset?: boolean } = {}): void {
    if (!this._isActive) {
      return;
    }
    this._activation?.abort();
    if (!reset) {
      this._commit();
    }
    this._isActive = false;

    this._transitionToCrop();

    applyClassNames(this, {
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
    signal: AbortSignal,
  ): Promise<HTMLImageElement> {
    const src = await this.whileAdopted(
      controller.proxyUrl(cropperImageSrc(originalUrl, this.offsetWidth, transformations, controller.sourceOperations)),
    );
    // Before the loading flag goes up: an image that never starts loading would never clear it.
    signal.throwIfAborted();
    const { promise, image } = preloadImage(src, { signal });

    // Not bound to the adoption: the loading flag lives on the controller and must clear even if the load lands late.
    // An abort cancels the load to a transparent pixel, whose `load` clears it too.
    const stop = trackImageLoading(controller);
    image.addEventListener('load', stop, { once: true });
    image.addEventListener('error', stop, { once: true });

    try {
      await this.whileAdopted(promise);
    } catch (err) {
      if (isAbortError(err)) throw err;
      this._log.error('Failed to load image', { error: err });
      controller.networkProblems = true;
    }
    return image;
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    // The `imageSize` prop is not controller state, so no controller observer
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
    this._image = null;
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
