import { Block } from '../../../abstract/Block';
import {
  createCdnUrl,
  createCdnUrlModifiers,
  createOriginalUrl,
  extractOperations,
  extractUuid,
} from '../../../utils/cdn-utils';
import { debounce } from '../../../utils/debounce.js';
import { TRANSPARENT_PIXEL_SRC } from '../../../utils/transparentPixelSrc';
import type { EditorImageCropper } from './EditorImageCropper';
import type { EditorImageFader } from './EditorImageFader';
import { classNames } from './lib/classNames.js';
import { getClosestAspectRatio, parseCropPreset } from './lib/parseCropPreset.js';
import { parseTabs } from './lib/parseTabs.js';
import { operationsToTransformations, transformationsToOperations } from './lib/transformationUtils.js';
import { initState } from './state.js';
import { TEMPLATE } from './template.js';
import { TabId } from './toolbar-constants.js';
import type { ApplyResult, CropPresetList, ImageSize, Transformations } from './types';

type TabIdValue = (typeof TabId)[keyof typeof TabId];

interface CloudImageEditorBlockState extends ReturnType<typeof initState> {}

export class CloudImageEditorBlock extends Block {
  override ctxOwner = true;
  static override styleAttrs = ['uc-cloud-image-editor'];

  private _debouncedShowLoader = debounce(this._showLoader.bind(this), 300);

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      ...initState(this),
    } as CloudImageEditorBlockState;
  }

  private _showLoader(show: boolean): void {
    this.$.showLoader = show;
  }

  /**
   * To proper work, we need non-zero size the element. So, we'll wait for it.
   */
  private _waitForSize(): Promise<void> {
    const TIMEOUT = 3000;
    return new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error('[cloud-image-editor] timeout waiting for non-zero container size'));
      }, TIMEOUT);
      const resizeObserver = new ResizeObserver((entries) => {
        const [element] = entries;
        if (!element) {
          return;
        }
        if (element.contentRect.width > 0 && element.contentRect.height > 0) {
          window.clearTimeout(timeoutId);
          resizeObserver.disconnect();
          window.setTimeout(() => resolve(), 0);
        }
      });
      resizeObserver.observe(this);
    });
  }

  override initCallback(): void {
    super.initCallback();

    this.$['*faderEl'] = this.ref['fader-el'];
    this.$['*cropperEl'] = this.ref['cropper-el'];
    this.$['*imgContainerEl'] = this.ref['img-container-el'];

    this.initEditor();
  }

  async updateImage(): Promise<void> {
    if (!this.isConnected) {
      return;
    }
    await this._waitForSize();

    if (this.$.cdnUrl) {
      const cdnUrlValue = this.$.cdnUrl as string;
      const uuid = extractUuid(cdnUrlValue);
      const originalUrl = createOriginalUrl(cdnUrlValue, uuid);
      if (originalUrl === this.$['*originalUrl']) {
        return;
      }
      this.$['*originalUrl'] = originalUrl;
      const operations = extractOperations(cdnUrlValue);
      const transformations = operationsToTransformations(operations) as Transformations;
      this.$['*editorTransformations'] = transformations;
    } else if (this.$.uuid) {
      const originalUrl = createOriginalUrl(this.cfg.cdnCname, this.$.uuid as string);
      if (originalUrl === this.$['*originalUrl']) {
        return;
      }
      this.$['*originalUrl'] = originalUrl;
      this.$['*editorTransformations'] = {};
    } else {
      throw new Error('No UUID nor CDN URL provided');
    }

    if (this.$['*tabId'] === TabId.CROP) {
      (this.$['*cropperEl'] as EditorImageCropper)?.deactivate({ reset: true });
    } else {
      (this.$['*faderEl'] as EditorImageFader)?.deactivate();
    }

    try {
      const originalUrlValue = this.$['*originalUrl'] as string;
      const cdnUrl = await this.proxyUrl(createCdnUrl(originalUrlValue, createCdnUrlModifiers('json')));
      const json = (await fetch(cdnUrl).then((response) => response.json())) as { width: number; height: number };

      const { width, height } = json;
      this.$['*imageSize'] = { width, height };

      if (this.$['*tabId'] === TabId.CROP) {
        (this.$['*cropperEl'] as EditorImageCropper)?.activate(this.$['*imageSize'] as ImageSize);
      } else {
        (this.$['*faderEl'] as EditorImageFader)?.activate({ url: originalUrlValue });
      }
    } catch (err) {
      if (err) {
        this.telemetryManager.sendEventError(err, 'cloud editor image. Failed to load image info');
        console.error('Failed to load image info', err);
      }
    }
  }

  async initEditor(): Promise<void> {
    try {
      await this._waitForSize();
    } catch (err) {
      if (this.isConnected) {
        // @ts-expect-error TODO: fix this
        console.error(err.message);
      }
      return;
    }

    this.ref['img-el'].addEventListener('load', () => {
      this._debouncedShowLoader(false);

      if (this.$.src !== TRANSPARENT_PIXEL_SRC) {
        this.$['*networkProblems'] = false;
      }
    });

    this.ref['img-el'].addEventListener('error', () => {
      this._debouncedShowLoader(false);

      this.$['*networkProblems'] = true;
    });

    this.sub('src', (src) => {
      const el = this.ref['img-el'];
      if (el.src !== src) {
        el.src = src || TRANSPARENT_PIXEL_SRC;
      }
    });

    this.sub('tabs', (val: string) => {
      this.$['*tabList'] = parseTabs(val);
    });

    this.sub('*tabId', (tabId: TabIdValue) => {
      (this.ref['img-el'] as HTMLImageElement).className = classNames('uc-image', {
        'uc-image_hidden_to_cropper': tabId === TabId.CROP,
        'uc-image_hidden_effects': tabId !== TabId.CROP,
      });
    });

    this.classList.add('uc-editor_ON');

    this.sub('*networkProblems', (networkProblems) => {
      this.$['presence.networkProblems'] = networkProblems;
      this.$['presence.modalCaption'] = !networkProblems;
    });

    this.sub(
      '*editorTransformations',
      (transformations: Transformations) => {
        if (Object.keys(transformations).length === 0) {
          return;
        }
        const originalUrl = this.$['*originalUrl'] as string;
        const cdnUrlModifiers = createCdnUrlModifiers(transformationsToOperations(transformations), 'preview');
        const cdnUrl = createCdnUrl(originalUrl, cdnUrlModifiers);

        const eventData: ApplyResult = {
          originalUrl,
          cdnUrlModifiers,
          cdnUrl,
          transformations,
        };
        this.dispatchEvent(
          new CustomEvent<ApplyResult>('change', {
            detail: eventData,
            bubbles: true,
            composed: true,
          }),
        );
      },
      false,
    );

    this.sub('uuid', (val: string | null) => val && this.updateImage());
    this.sub('cdnUrl', (val: string | null) => val && this.updateImage());

    this.sub('cropPreset', (val: string) => {
      const list = parseCropPreset(val) as CropPresetList;
      let closest: CropPresetList[number] | null = null;

      if (this.$.cdnUrl) {
        const operations = extractOperations(this.$.cdnUrl as string);
        const transformations = operationsToTransformations(operations) as Transformations;

        if (Array.isArray(transformations?.crop?.dimensions)) {
          const [w, h] = transformations.crop.dimensions;
          closest = getClosestAspectRatio(w, h, list, 0.1);
        }
      }

      this.$['*cropPresetList'] = list;
      this.$['*currentAspectRatio'] = closest ?? list?.[0] ?? null;
    });
  }
}

CloudImageEditorBlock.template = TEMPLATE;
CloudImageEditorBlock.bindAttributes({
  uuid: 'uuid',
  'cdn-url': 'cdnUrl',
  'crop-preset': 'cropPreset',
  tabs: 'tabs',
});
