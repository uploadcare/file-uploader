import type { PropertyValues, TemplateResult } from 'lit';
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import type { CloudImageEditorController } from '../../../abstract/controllers/CloudImageEditorController';
import { debounce } from '../../../utils/debounce.js';
import { batchPreloadImages } from '../../../utils/preloadImage.js';
import { EditorBlock } from './editor-context';
import { classNames } from './lib/classNames.js';
import { linspace } from './lib/linspace.js';
import { COLOR_OPERATIONS_CONFIG, type ColorPreview, TabId } from './toolbar-constants.js';
import type { ImageSize, Transformations } from './types';
import { viewerImageSrc } from './util.js';

type OperationKey = keyof typeof COLOR_OPERATIONS_CONFIG;

type Keypoint = {
  src: string;
  opacity: number;
  zIndex: number;
  image: HTMLImageElement | undefined;
  value: number;
};

type ImageSrcOptions = {
  url?: string;
  filter?: string;
  operation?: OperationKey;
  value?: number;
};

type DebouncedKeypointHandler = ((
  operation: OperationKey,
  filter: string | undefined,
  value: number,
) => Promise<void>) & {
  cancel: () => void;
};

function isOperationKey(value: unknown): value is OperationKey {
  return typeof value === 'string' && value in COLOR_OPERATIONS_CONFIG;
}

function splitBySections(numbers: number[]): Array<[number, number]> {
  const sections: Array<[number, number]> = [];
  for (let idx = 0; idx < numbers.length - 1; idx += 1) {
    const current = numbers[idx];
    const next = numbers[idx + 1];
    if (typeof current === 'number' && typeof next === 'number') {
      sections.push([current, next]);
    }
  }
  return sections;
}

function calculateOpacities(keypoints: number[], value: number, zero: number): number[] {
  const section = splitBySections(keypoints).find(([left, right]) => left <= value && value <= right);
  if (!section) {
    return keypoints.map(() => 0);
  }
  const [left, right] = section;
  return keypoints.map((point) => {
    const distance = Math.abs(left - right) || 1;
    const relation = Math.abs(value - left) / distance;

    if (left === point) {
      return value > zero ? 1 : 1 - relation;
    }
    if (right === point) {
      return value >= zero ? relation : 1;
    }
    return 0;
  });
}

function calculateZIndices(keypoints: number[], zero: number): number[] {
  return keypoints.map((point, idx) => (point < zero ? keypoints.length - idx : idx));
}

function keypointsRange(operation: OperationKey, value: number): number[] {
  const n = COLOR_OPERATIONS_CONFIG[operation].keypointsNumber;
  const { range, zero } = COLOR_OPERATIONS_CONFIG[operation];

  return [...new Set([...linspace(range[0], zero, n + 1), ...linspace(zero, range[1], n + 1), zero, value])].sort(
    (a, b) => a - b,
  );
}

export class EditorImageFader extends EditorBlock {
  private _isActive = false;
  private _hidden = true;
  private _operation: OperationKey | 'initial' = 'initial';
  private _filter: string | undefined;
  private _value?: number;
  private _transformations: Transformations = {};
  private _keypoints: Keypoint[] = [];
  private _previewImage?: HTMLImageElement;
  private _cancelLastImages?: () => void;
  private _cancelBatchPreload?: () => void;
  private _url?: string;
  private _fromViewer?: boolean;
  private _raf = 0;
  private _addKeypointDebounced!: DebouncedKeypointHandler;
  private readonly _previewHostRef = createRef<HTMLDivElement>();
  private readonly _layersHostRef = createRef<HTMLDivElement>();

  /**
   * Loaded image size, passed from the root as a plain Lit prop (DOM-derived,
   * not controller state) — the fader shows only once it and `*originalUrl` are
   * ready on a non-crop tab (see `_syncFromState`). Root clears it to null on a
   * new image, which reliably re-triggers the reaction.
   */
  @property({ attribute: false })
  public imageSize: ImageSize | null = null;

  // Last-seen controller values, to detect real per-key changes in the coarse
  // `subscribeEditor` reaction (it fires on ANY state change).
  private _lastOriginalUrl: string | null = null;
  private _lastColorPreview: ColorPreview = null;
  private _lastTransformations?: Transformations;
  private _shown = false;
  // Guards the reaction against re-entering itself: the fader's own methods
  // write state (`*loadingOperations`, `*networkProblems`) and `set` notifies
  // synchronously (same lesson as EditorImageCropper).
  private _reacting = false;

  public constructor() {
    super();

    this.classList.add('uc-inactive_to_cropper');
    this._addKeypointDebounced = debounce(async (operation, filter, value) => {
      // Capture the controller once, before any `await`, so the rest of this
      // callback keeps working off a stable instance even if the element
      // disconnects mid-flight (the `editorController` accessor throws once
      // detached; the captured instance stays usable) — same lesson as
      // `EditorImageCropper.activate`.
      const controller = this.editorControllerOrNull;
      if (!controller) {
        return;
      }
      const shouldSkip = () =>
        !this._isSame(operation, filter) || this._value !== value || !!this._keypoints.find((kp) => kp.value === value);

      if (shouldSkip()) {
        return;
      }
      const keypoint = await this._constructKeypoint(controller, operation, value);
      const image = new Image();
      image.src = keypoint.src;
      const stop = this._handleImageLoading(controller, keypoint.src);
      image.addEventListener('load', stop, { once: true });
      image.addEventListener('error', stop, { once: true });
      keypoint.image = image;
      image.classList.add('uc-fader-image');

      image.addEventListener(
        'load',
        () => {
          if (shouldSkip()) {
            return;
          }
          const keypoints = this._keypoints;
          let insertIndex = keypoints.findIndex((kp) => kp.value > value);
          if (insertIndex === -1) {
            insertIndex = keypoints.length;
          }
          const nextKeypoint = keypoints[insertIndex];
          const insertBeforeNode = nextKeypoint?.image;
          const container = this._layersHostRef.value;
          if (!container || (insertBeforeNode && !container.contains(insertBeforeNode))) {
            return;
          }
          keypoints.splice(insertIndex, 0, keypoint);
          if (insertBeforeNode) {
            container.insertBefore(image, insertBeforeNode);
          } else {
            container.appendChild(image);
          }
          this._update(operation, value);
        },
        { once: true },
      );

      image.addEventListener(
        'error',
        () => {
          controller.set('*networkProblems', true);
        },
        { once: true },
      );
    }, 600);

    // Controller-dependent setup (mirrors EditorImageCropper): the fader now
    // drives itself from state instead of the toolbar/root/slider calling its
    // methods. It reacts to `*tabId`/`*originalUrl`/`*editorTransformations`/
    // `*colorPreview` (+ the `imageSize` prop) and calls its own unchanged
    // activate/set/deactivate/setTransformations.
    this.onEditorAttach(() => {
      const controller = this.editorController;
      this._lastOriginalUrl = controller.get('*originalUrl');
      this._lastColorPreview = controller.get('*colorPreview');
      this.subscribeEditor(() => this._syncFromState());
    });
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    // `imageSize` is a prop, not controller state, so `subscribeEditor` won't
    // fire for it — re-evaluate visibility when the root updates it.
    if (changedProperties.has('imageSize')) {
      this._syncFromState();
    }
  }

  /**
   * Reconcile the fader with controller state — the reactive replacement for
   * the old imperative calls from the toolbar (`_applyTabState`,
   * `*editorTransformations`, `*originalUrl`), the root (`_activateViewer`),
   * and the slider (`set`/`activate`/`deactivate`).
   */
  private _syncFromState(): void {
    if (this._reacting) {
      return;
    }
    this._reacting = true;
    try {
      const controller = this.editorControllerOrNull;
      if (!controller) {
        return;
      }
      const tabId = controller.get('*tabId');
      const originalUrl = controller.get('*originalUrl');
      const colorPreview = controller.get('*colorPreview');
      const transformations = controller.get('*editorTransformations');
      const shouldShow = tabId !== TabId.CROP && !!originalUrl && !!this.imageSize;

      // New image: hide and stay hidden until the root supplies the new image's
      // `imageSize` prop (reactivation then happens via `updated`). Returning
      // here avoids re-activating with the previous image's still-stale
      // `imageSize` (root clears it to null asynchronously) or reapplying its
      // live preview — the root also clears `*colorPreview` on image change.
      if (originalUrl !== this._lastOriginalUrl) {
        this._lastOriginalUrl = originalUrl;
        this._lastColorPreview = null;
        if (this._shown) {
          this.deactivate();
          this._shown = false;
        }
        return;
      }

      if (shouldShow && !this._shown) {
        // Enter viewer mode: seed `_transformations` so `activate` (original)
        // renders the committed result, matching the old tab-switch behaviour.
        this._shown = true;
        this._lastTransformations = transformations;
        this._transformations = transformations;
        void this.activate({ url: originalUrl as string, fromViewer: false });
      } else if (!shouldShow && this._shown) {
        this._shown = false;
        this.deactivate();
      }

      if (!this._shown) {
        return;
      }

      // Committed transformations → refresh the viewer image (old toolbar sub).
      if (transformations !== this._lastTransformations) {
        this._lastTransformations = transformations;
        void this.setTransformations(transformations);
      }

      // Live slider preview: op/filter change → rebuild keypoints (`activate`);
      // same op, new value → `set`; cleared → back to the committed viewer.
      if (colorPreview !== this._lastColorPreview) {
        const previous = this._lastColorPreview;
        this._lastColorPreview = colorPreview;
        if (colorPreview) {
          const opChanged =
            !previous || previous.operation !== colorPreview.operation || previous.filter !== colorPreview.filter;
          if (opChanged) {
            void this.activate({
              url: originalUrl as string,
              operation: colorPreview.operation,
              value: colorPreview.value,
              filter: colorPreview.filter,
              fromViewer: false,
            });
          } else if (typeof colorPreview.value === 'number') {
            this.set(colorPreview.value);
          }
        } else if (previous) {
          this.deactivate({ hide: false });
        }
      }
    } finally {
      this._reacting = false;
    }
  }

  private _handleImageLoading(controller: CloudImageEditorController, src: string): () => void {
    const operation = this._operation;

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

  private _flush(): void {
    window.cancelAnimationFrame(this._raf);
    this._raf = window.requestAnimationFrame(() => {
      for (const kp of this._keypoints) {
        const { image } = kp;
        if (image) {
          image.style.opacity = kp.opacity.toString();
          image.style.zIndex = kp.zIndex.toString();
        }
      }
    });
  }

  private _imageSrc(
    controller: CloudImageEditorController,
    { url = this._url, filter = this._filter ?? undefined, operation, value }: ImageSrcOptions = {},
  ): Promise<string> {
    if (!url) {
      throw new Error('URL is not defined');
    }
    const transformations: Transformations = { ...this._transformations };

    if (operation) {
      if (operation === 'filter') {
        if (filter && typeof value === 'number') {
          transformations.filter = { name: filter, amount: value };
        }
      } else if (typeof value === 'number') {
        transformations[operation] = value;
      }
    }

    // do not use getBoundingClientRect because scale transform affects it
    const width = this.offsetWidth;
    return controller.proxyUrl(viewerImageSrc(url, width, transformations));
  }

  private async _constructKeypoint(
    controller: CloudImageEditorController,
    operation: OperationKey,
    value: number,
  ): Promise<Keypoint> {
    const src = await this._imageSrc(controller, { operation, value });
    return {
      src,
      image: undefined,
      opacity: 0,
      zIndex: 0,
      value,
    };
  }

  /**
   * Check if current operation and filter equals passed ones
   */
  private _isSame(operation: string | undefined, filter: string | undefined): boolean {
    return this._operation === operation && this._filter === filter;
  }

  public set(value: string | number): void {
    const numericValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isOperationKey(this._operation) || !Number.isFinite(numericValue)) {
      return;
    }
    this._update(this._operation, numericValue);
    this._addKeypointDebounced(this._operation, this._filter, numericValue);
  }

  private _update(operation: OperationKey, value: number): void {
    this._operation = operation;
    this._value = value;

    const { zero } = COLOR_OPERATIONS_CONFIG[operation];

    const keypointValues = this._keypoints.map((kp) => kp.value);
    const opacities = calculateOpacities(keypointValues, value, zero);
    const zIndices = calculateZIndices(keypointValues, zero);

    this._keypoints.forEach((kp, idx) => {
      const opacity = opacities[idx];
      const zIndex = zIndices[idx];
      if (typeof opacity === 'number') {
        kp.opacity = opacity;
      }
      if (typeof zIndex === 'number') {
        kp.zIndex = zIndex;
      }
    });

    this._flush();
  }

  private _createPreviewImage(): HTMLImageElement {
    const image = new Image();
    image.classList.add('uc-fader-image', 'uc-fader-image--preview');
    image.style.opacity = '0';
    return image;
  }

  private async _initNodes(): Promise<void> {
    // Fire-and-forget from `activate` (not awaited), so it needs its own
    // controller capture rather than relying on one threaded in from a caller.
    const controller = this.editorControllerOrNull;
    if (!controller) {
      return;
    }

    this._previewImage = this._previewImage || this._createPreviewImage();
    const previewImage = this._previewImage;
    if (previewImage) {
      this._ensurePreviewAttached(previewImage);
    }

    const srcList = this._keypoints.map((kp) => kp.src);

    const { images, promise, cancel } = batchPreloadImages(srcList);
    images.forEach((node) => {
      const stop = this._handleImageLoading(controller, node.src);
      node.addEventListener('load', stop);
      node.addEventListener('error', stop);
    });
    this._cancelLastImages = () => {
      cancel();
      this._cancelLastImages = undefined;
    };
    const operation = this._operation;
    const filter = this._filter;
    await promise;
    if (this._isActive && this._isSame(operation, filter)) {
      const host = this._layersHostRef.value;
      if (!host) {
        return;
      }
      host.replaceChildren();
      this._keypoints.forEach((kp, idx) => {
        const kpImage = images[idx];
        if (!kpImage) {
          return;
        }
        kpImage.classList.add('uc-fader-image');
        kp.image = kpImage;
        host.appendChild(kpImage);
      });
      this._flush();
    }
  }

  public async setTransformations(transformations: Transformations): Promise<void> {
    this._transformations = transformations;
    // Capture before the `await` below (see `_addKeypointDebounced`'s doc).
    const controller = this.editorControllerOrNull;
    if (this._previewImage && controller) {
      const src = await this._imageSrc(controller);
      const stop = this._handleImageLoading(controller, src);
      this._previewImage.src = src;
      this._previewImage.addEventListener('load', stop, { once: true });
      this._previewImage.addEventListener('error', stop, { once: true });
      this._previewImage.style.opacity = '1';

      this._previewImage.addEventListener(
        'error',
        () => {
          controller.set('*networkProblems', true);
        },
        { once: true },
      );
    }
  }

  public async preload({
    url,
    filter,
    operation,
    value,
  }: {
    url: string;
    filter?: string;
    operation?: OperationKey;
    value?: number;
  }): Promise<void> {
    if (!operation || typeof value !== 'number') {
      return;
    }
    const controller = this.editorControllerOrNull;
    if (!controller) {
      return;
    }
    this._cancelBatchPreload?.();

    const keypoints = keypointsRange(operation, value);
    const srcList = await Promise.all(
      keypoints.map((kp) => this._imageSrc(controller, { url, filter, operation, value: kp })),
    );
    const { cancel } = batchPreloadImages(srcList);

    this._cancelBatchPreload = cancel;
  }

  private _setOriginalSrc(controller: CloudImageEditorController, src: string): void {
    const image = this._previewImage || this._createPreviewImage();
    this._ensurePreviewAttached(image);
    this._previewImage = image;

    if (image.src === src) {
      image.style.opacity = '1';
      image.style.transform = 'scale(1)';

      this.className = classNames({
        'uc-active_from_viewer': this._fromViewer,
        'uc-active_from_cropper': !this._fromViewer,
        'uc-inactive_to_cropper': false,
      });
      return;
    }
    image.style.opacity = '0';
    const stop = this._handleImageLoading(controller, src);
    image.addEventListener('error', stop, { once: true });
    image.src = src;
    image.addEventListener(
      'load',
      () => {
        stop();
        if (image) {
          image.style.opacity = '1';
          image.style.transform = 'scale(1)';

          this.className = classNames({
            'uc-active_from_viewer': this._fromViewer,
            'uc-active_from_cropper': !this._fromViewer,
            'uc-inactive_to_cropper': false,
          });
        }
      },
      { once: true },
    );
    image.addEventListener(
      'error',
      () => {
        controller.set('*networkProblems', true);
      },
      { once: true },
    );
  }

  public async activate({
    url,
    operation,
    value,
    filter,
    fromViewer,
  }: {
    url: string;
    operation?: OperationKey;
    value?: number;
    filter?: string;
    fromViewer?: boolean;
  }): Promise<void> {
    this._isActive = true;
    this._hidden = false;
    await this.updateComplete;
    // Capture once, right after the gate-await above, and reuse this instance
    // for the remainder of the method (including across the further awaits
    // below) rather than re-reading the `editorController` accessor — mirrors
    // `EditorImageCropper.activate`.
    const controller = this.editorControllerOrNull;
    if (!controller) {
      return;
    }
    this._url = url;
    this._operation = operation ?? 'initial';
    this._value = value;
    this._filter = filter;
    this._fromViewer = fromViewer;

    const isOriginal = typeof value !== 'number' && !filter;
    if (isOriginal) {
      const src = await this._imageSrc(controller, { operation, value });
      this._setOriginalSrc(controller, src);
      this._clearLayersHost();
      return;
    }
    if (!operation || typeof value !== 'number') {
      return;
    }
    this._keypoints = await Promise.all(
      keypointsRange(operation, value).map((keyValue) => this._constructKeypoint(controller, operation, keyValue)),
    );

    this._update(operation, value);
    this._initNodes();
  }

  public deactivate({ hide = true }: { hide?: boolean } = {}): void {
    this._isActive = false;

    this._cancelLastImages?.();
    this._cancelBatchPreload?.();

    if (hide && !this._hidden) {
      this._hidden = true;
      if (this._previewImage) {
        this._previewImage.style.transform = 'scale(1)';
      }

      this.className = classNames({
        'uc-active_from_viewer': false,
        'uc-active_from_cropper': false,
        'uc-inactive_to_cropper': true,
      });
      this.addEventListener(
        'transitionend',
        () => {
          this._clearLayersHost();
        },
        { once: true },
      );
    } else {
      this._clearLayersHost();
    }
  }

  private _ensurePreviewAttached(image: HTMLImageElement): void {
    const host = this._previewHostRef.value;
    if (!host) {
      return;
    }
    if (!host.contains(image)) {
      host.appendChild(image);
    }
  }

  private _clearLayersHost(): void {
    this._layersHostRef.value?.replaceChildren();
  }

  public override render(): TemplateResult {
    return html`
      <div class="uc-fader-preview-host" ${ref(this._previewHostRef)}></div>
      <div class="uc-fader-layers-host" ${ref(this._layersHostRef)}></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-image-fader': EditorImageFader;
  }
}
