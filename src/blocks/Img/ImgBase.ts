import { isProxyUrl, parseFileUrl, parseProxyUrl, serializeFileUrl, serializeProxyUrl } from '@uploadcare/cdn-url';
import { logger } from '../../abstract/logger';
import { operationsFromModifiers } from '../../utils/cdn/operations';
import { deliveryProxyOrigin } from '../../utils/cdn/origin';
import { deserializeCsv } from '../../utils/comma-separated';
import { applyTemplateData } from '../../utils/template-utils';
import { uniqueArray } from '../../utils/uniqueArray';
import {
  DEV_MODE,
  HI_RES_K,
  MAX_WIDTH,
  MAX_WIDTH_JPG,
  ULTRA_RES_K,
  UNRESOLVED_ATTR,
} from './configurations';
import { type CssPropValue, ImgConfig } from './ImgConfig';
import type { ImgPropKey } from './props-map';

const log = logger.scope('img');

type LoaderParams = {
  src?: string;
  srcset?: string;
  elNode: HTMLImageElement;
};

type ConfigImageParams = {
  elNode: HTMLImageElement;
};

type AppendUrlParams = {
  elNode: HTMLImageElement;
  src?: string;
  srcset?: string;
};

export class ImgBase extends ImgConfig {
  private _img: HTMLImageElement = new Image();
  private _imgPreview: HTMLImageElement = new Image();

  /** A config value as a string; unset (`null`/`undefined`) reads as `''`. */
  private _str(key: ImgPropKey): string {
    const value = this.$$(key);
    return value === null || value === undefined ? '' : String(value);
  }

  private _fmtAbs(src: string): string {
    const isRel = !src.includes('//');
    if (isRel && !DEV_MODE) {
      src = new URL(src, document.baseURI).href;
    }
    return src;
  }

  private _validateSize(size?: string | null): string | null | undefined {
    if (!size) {
      return undefined;
    }
    const numericPart = size.match(/\d+/)?.[0];
    const alphabeticPart = size.match(/[a-zA-Z]+/)?.[0];

    if (!numericPart || !alphabeticPart) {
      return undefined;
    }

    const bp = parseInt(numericPart, 10);

    const max = this._hasFormatJPG ? MAX_WIDTH_JPG : MAX_WIDTH;
    return bp > max ? max + alphabeticPart : size;
  }

  private _getCdnOperationFragments(size?: string | null, blur?: string | null): CssPropValue[] {
    const params: Record<string, CssPropValue> = {
      format: this.$$('format'),
      quality: this.$$('quality'),
      resize: this._validateSize(size),
      blur,
    };
    // `null` is not filtered out, so a null value still emits `<key>/null`.
    // `operationsFromModifiers` drops the non-string and empty fragments.
    return [
      ...Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${key}/${value}`),
      this.$$('cdn-operations'),
      this.analyticsParams(),
    ];
  }

  private _getUrlBase(size: string | null = '', blur: string | null = ''): string | undefined {
    const src = this._str('src');
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      return src;
    }

    if (DEV_MODE && src && !src.includes('//')) {
      return this._proxyUrl(src);
    }

    try {
      return this._buildCdnUrl(size, blur, src);
    } catch (err) {
      // `@uploadcare/cdn-url` rejects anything that is not a real CDN URL — a
      // malformed `uuid`, a blanked `cdn-cname`, an unparseable `cdn-operations`
      // attribute. This is user-supplied config reaching a render path, so it
      // degrades to "no image" with a warning rather than throwing out of
      // rendering (the previous string-concatenating implementation would have
      // produced a broken URL instead, which failed just as silently).
      log.warn('Failed to build a CDN URL from the configured attributes', err);
      return undefined;
    }
  }

  private _buildCdnUrl(size: string | null, blur: string | null, src: string): string | undefined {
    const operations = operationsFromModifiers(...this._getCdnOperationFragments(size, blur));
    const cdnCname = this._str('cdn-cname');

    // A src already on the configured cname is a CDN URL in its own right: parse
    // it and append, so operations it already carries survive.
    //
    // `<uc-img>` renders a single stored file or a proxied remote source. Parsing
    // only those two kinds keeps the group parsers out of the bundle entirely —
    // this element has the tightest size budget in the repo.
    if (cdnCname && src.startsWith(cdnCname)) {
      if (isProxyUrl(src)) {
        const parsed = parseProxyUrl(src);
        return serializeProxyUrl({ ...parsed, operations: [...parsed.operations, ...operations] });
      }
      const parsed = parseFileUrl(src);
      return serializeFileUrl({ ...parsed, operations: [...parsed.operations, ...operations] });
    }

    const uuid = this._str('uuid');
    if (uuid) {
      // `cdn-cname` carries a default, so a blank one means it was blanked on
      // purpose — `new URL('')` throws and the caller degrades, which is what the
      // previous implementation did by accident.
      const url = serializeFileUrl({ cdnBase: new URL(cdnCname).origin, uuid, operations });
      // `serializeFileUrl` builds without validating — it is `parseFileUrl` that
      // knows the UUID grammar. Parsing the result back keeps a garbage `uuid`
      // attribute degrading to "no image" instead of emitting a URL that 404s.
      parseFileUrl(url);
      return this._proxyUrl(url);
    }

    const proxyCname = this._str('proxy-cname');
    if (proxyCname) {
      return this._proxyUrl(serializeProxyUrl({ cdnBase: proxyCname, sourceUrl: this._fmtAbs(src), operations }));
    }

    const pubkey = this._str('pubkey');
    if (pubkey) {
      return this._proxyUrl(
        serializeProxyUrl({ cdnBase: deliveryProxyOrigin(pubkey), sourceUrl: this._fmtAbs(src), operations }),
      );
    }

    return undefined;
  }

  private _proxyUrl(url: string): string {
    const previewProxy = this._str('secure-delivery-proxy');
    if (!previewProxy) {
      return url;
    }
    return applyTemplateData(
      previewProxy,
      { previewUrl: url },
      { transform: (value) => window.encodeURIComponent(value) },
    );
  }

  /** @internal */
  protected _getElSize(el: HTMLElement, k = 1): string | null {
    const w = k * Math.round(el.getBoundingClientRect().width);
    return w ? `${w}x` : null;
  }

  private _setupEventProxy(img: HTMLImageElement): void {
    const proxifyEvent = (e: Event) => {
      e.stopPropagation();
      const event = new Event(e.type, e as EventInit);
      this.dispatchEvent(event);
    };
    const EVENTS: Array<'load' | 'error'> = ['load', 'error'];
    for (const event of EVENTS) {
      img.addEventListener(event, proxifyEvent);
    }
  }

  protected get img(): HTMLImageElement {
    if (!this._hasPreviewImage) {
      this._setupConfigForImage({ elNode: this._img });
      this.appendChild(this._img);
    }
    return this._img;
  }

  private get _currentImg(): HTMLImageElement {
    return this._hasPreviewImage ? this._imgPreview : this.img;
  }

  private get _hasPreviewImage(): CssPropValue {
    return this.$$('is-preview-blur');
  }

  private get _bgSelector(): string {
    return this._str('is-background-for');
  }

  private get _breakpoints(): number[] | null {
    const breakpointsValue = this._str('breakpoints');
    if (breakpointsValue) {
      const list = deserializeCsv(breakpointsValue);
      return uniqueArray(list.map((bp) => parseInt(bp, 10)));
    } else {
      return null;
    }
  }

  private get _hasFormatJPG(): boolean {
    return this._str('format').toLowerCase() === 'jpeg';
  }

  /** Pixel-density multipliers: 1x, plus 2x/3x when hi-/ultra-res support is on. */
  private get _densities(): number[] {
    const k = [1];
    if (this.$$('hi-res-support')) k.push(HI_RES_K);
    if (this.$$('ultra-res-support')) k.push(ULTRA_RES_K);
    return k;
  }

  private _renderBg(el: HTMLElement): void {
    const imgSet = new Set<string>();
    for (const k of this._densities) {
      const url = this._getUrlBase(this._getElSize(el, k));
      if (url) imgSet.add(`url("${url}") ${k}x`);
    }

    if (!imgSet.size) {
      el.style.removeProperty('background-image');
      return;
    }
    const iSet = `image-set(${[...imgSet].join(', ')})`;
    el.style.setProperty('background-image', iSet);
    el.style.setProperty('background-image', `-webkit-${iSet}`);
  }

  private _getSrcset(): string {
    const srcset = new Set<string>();
    const add = (url: string | undefined, descriptor: string | null | undefined): void => {
      if (url) srcset.add(`${url} ${descriptor}`);
    };
    const densities = this._densities;
    const breakpoints = this._breakpoints;
    if (breakpoints) {
      for (const bp of breakpoints) {
        for (const k of densities) add(this._getUrlBase(`${bp * k}x`), this._validateSize(`${bp * k}w`));
      }
    } else {
      for (const k of densities) add(this._getUrlBase(this._getElSize(this._currentImg, k)), `${k}x`);
    }
    return [...srcset].join();
  }

  private _getSrc(): string | undefined {
    return this._getUrlBase();
  }

  private get _srcUrlPreview(): string | undefined {
    return this._getUrlBase('100x', '100');
  }

  private _renderBackground(): void {
    [...document.querySelectorAll(this._bgSelector)].forEach((el) => {
      if (this.$$('intersection')) {
        this.initIntersection(el as HTMLElement, () => {
          this._renderBg(el as HTMLElement);
        });
      } else {
        this._renderBg(el as HTMLElement);
      }
    });
  }

  private _appendURL({ elNode, src, srcset }: AppendUrlParams): void {
    // No URL clears the attribute: a stale image must not survive a config that no longer resolves.
    if (src) {
      elNode.src = src;
    } else {
      elNode.removeAttribute('src');
    }

    if (srcset) {
      elNode.srcset = srcset;
    } else {
      elNode.removeAttribute('srcset');
    }
  }

  private _setupConfigForImage({ elNode }: ConfigImageParams): void {
    this._setupEventProxy(elNode);
    this.initAttributes(elNode);
  }

  private _loaderImage({ src, srcset, elNode }: LoaderParams): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      this._setupConfigForImage({ elNode });

      elNode.setAttribute(UNRESOLVED_ATTR, '');

      elNode.addEventListener('load', () => {
        elNode.removeAttribute(UNRESOLVED_ATTR);
        resolve(elNode);
      });

      elNode.addEventListener('error', () => {
        reject(false);
      });

      this._appendURL({
        elNode,
        src,
        srcset,
      });
    });
  }

  private async _renderImage(): Promise<void> {
    // Load the final image, then swap it in for the preview whether or not it loaded.
    const load = async (): Promise<void> => {
      try {
        await this._loaderImage({ src: this._getSrc(), srcset: this._getSrcset(), elNode: this._img });
      } catch {}
      if (this._hasPreviewImage) {
        this._imgPreview.remove();
      }
      this.appendChild(this._img);
    };

    if (this.$$('intersection')) {
      if (this._hasPreviewImage) {
        this._setupConfigForImage({ elNode: this._imgPreview });
        this.appendChild(this._imgPreview);
      }

      this.initIntersection(this._currentImg, () => {
        const previewUrl = this._srcUrlPreview;
        if (this._hasPreviewImage && previewUrl) {
          this._imgPreview.src = previewUrl;
        }
        return load();
      });
      return;
    }

    if (this._hasPreviewImage) {
      try {
        await this._loaderImage({ src: this._srcUrlPreview, elNode: this._imgPreview });
        this.appendChild(this._imgPreview);
      } catch {
        // A failed preview skips loading the final image and shows it as is.
        this._imgPreview.remove();
        this.appendChild(this._img);
        return;
      }
    }
    await load();
  }

  protected init(): void {
    if (this._bgSelector) {
      this._renderBackground();
    } else {
      // `<uc-img>` has no lifetime of its own; a detached element appending its image is harmless, a failure is not.
      this._renderImage().catch((error: unknown) => log.error('Failed to render the image', error));
    }
  }
}
