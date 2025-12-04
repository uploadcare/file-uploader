import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils.js';
import { stringToArray } from '../../utils/stringToArray';
import { applyTemplateData } from '../../utils/template-utils';
import { uniqueArray } from '../../utils/uniqueArray';
import {
  DEV_MODE,
  HI_RES_K,
  ImgTypeEnum,
  MAX_WIDTH,
  MAX_WIDTH_JPG,
  ULTRA_RES_K,
  UNRESOLVED_ATTR,
} from './configurations';
import { ImgConfig } from './ImgConfig';
import { type ParseableParams, parseObjectToString } from './utils/parseObjectToString';

type ImgType = (typeof ImgTypeEnum)[keyof typeof ImgTypeEnum];

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

type CurrentImg = {
  type: ImgType;
  img: HTMLImageElement;
};

export class ImgBase extends ImgConfig {
  protected _img: HTMLImageElement = new Image();
  protected _imgPreview: HTMLImageElement = new Image();

  private _fmtAbs(src: string): string {
    const isRel = !src.includes('//');
    if (isRel && !DEV_MODE) {
      src = new URL(src, document.baseURI).href;
    }
    return src;
  }

  private _validateSize(size?: string | null): string | null | undefined {
    if (size?.trim() !== '') {
      const ensuredSize = size as string;
      const numericPart = ensuredSize.match(/\d+/)![0];
      const alphabeticPart = ensuredSize.match(/[a-zA-Z]+/)![0];

      const bp = parseInt(numericPart, 10);

      if (Number(bp) > MAX_WIDTH_JPG && this.hasFormatJPG) {
        return MAX_WIDTH_JPG + alphabeticPart;
      } else if (Number(bp) > MAX_WIDTH && !this.hasFormatJPG) {
        return MAX_WIDTH + alphabeticPart;
      }
    }

    return size;
  }

  private _getCdnModifiers(size?: string | null, blur?: string | null): string {
    const params: ParseableParams = {
      format: this._getTypedCssValue('format'),
      quality: this._getTypedCssValue('quality'),
      resize: this._validateSize(size),
      blur,
      'cdn-operations': this._getTypedCssValue('cdn-operations') ?? undefined,
      analytics: this.analyticsParams(),
    };

    return createCdnUrlModifiers(...parseObjectToString(params));
  }

  private _getTypedCssValue(key: string): string | number | boolean | null | undefined {
    const value = this.$$(key);
    if (value === null || value === undefined) {
      return value as null | undefined;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    return undefined;
  }

  private _getUrlBase(size: string | null = '', blur: string | null = ''): string | undefined {
    const src = this.$$('src') as string;
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      return src;
    }

    if (DEV_MODE && src && !src.includes('//')) {
      return this._proxyUrl(src);
    }

    const cdnModifiers = this._getCdnModifiers(size, blur);
    const cdnCnameRaw = this.$$('cdn-cname') as string | undefined;
    const cdnCname = cdnCnameRaw;

    if (src.startsWith(String(cdnCnameRaw))) {
      return createCdnUrl(src, cdnModifiers);
    }

    const uuid = this.$$('uuid') as string | undefined;

    if (cdnCname && uuid) {
      return this._proxyUrl(createCdnUrl(createOriginalUrl(cdnCname, uuid), cdnModifiers));
    }

    if (uuid) {
      return this._proxyUrl(createCdnUrl(createOriginalUrl(cdnCname as string, uuid), cdnModifiers));
    }

    const proxyCname = this.$$('proxy-cname') as string | undefined;
    if (proxyCname) {
      return this._proxyUrl(createCdnUrl(proxyCname, cdnModifiers, this._fmtAbs(src)));
    }

    const pubkey = this.$$('pubkey') as string | undefined;
    if (pubkey) {
      return this._proxyUrl(createCdnUrl(`https://${pubkey}.ucr.io/`, cdnModifiers, this._fmtAbs(src)));
    }

    return undefined;
  }

  private _proxyUrl(url: string): string {
    const previewProxy = this.$$('secure-delivery-proxy') as string | undefined;
    if (!previewProxy) {
      return url;
    }
    return applyTemplateData(
      previewProxy,
      { previewUrl: url },
      { transform: (value) => window.encodeURIComponent(value) },
    );
  }

  protected _getElSize(el: HTMLElement, k = 1, wOnly = true): string | null {
    const rect = el.getBoundingClientRect();
    const w = k * Math.round(rect.width);
    const h = wOnly ? '' : k * Math.round(rect.height);

    if (w || h) {
      return `${w ? w : ''}x${h ? h : ''}`;
    } else {
      return null;
    }
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

  get img(): HTMLImageElement {
    if (!this.hasPreviewImage) {
      this._setupConfigForImage({ elNode: this._img });
      this.appendChild(this._img);
    }
    return this._img;
  }

  get currentImg(): CurrentImg {
    return this.hasPreviewImage
      ? {
          type: ImgTypeEnum.PREVIEW as ImgType,
          img: this._imgPreview,
        }
      : {
          type: ImgTypeEnum.MAIN as ImgType,
          img: this.img,
        };
  }

  get hasPreviewImage(): string | number | boolean | undefined {
    return this.$$('is-preview-blur') as string | number | boolean | undefined;
  }

  get bgSelector(): string | undefined {
    return this.$$('is-background-for') as string | undefined;
  }

  get breakpoints(): number[] | null {
    const breakpointsValue = this.$$('breakpoints') as string | undefined;
    if (breakpointsValue) {
      const list = stringToArray(breakpointsValue);
      return uniqueArray(list.map((bp) => parseInt(bp, 10)));
    } else {
      return null;
    }
  }

  get hasFormatJPG(): boolean {
    return (this.$$('format') as string).toLowerCase() === 'jpeg';
  }

  renderBg(el: HTMLElement): void {
    const imgSet = new Set<string>();

    imgSet.add(`url("${this._getUrlBase(this._getElSize(el)) as string}") 1x`);
    if (this.$$('hi-res-support')) {
      imgSet.add(`url("${this._getUrlBase(this._getElSize(el, HI_RES_K)) as string}") ${HI_RES_K}x`);
    }

    if (this.$$('ultra-res-support')) {
      imgSet.add(`url("${this._getUrlBase(this._getElSize(el, ULTRA_RES_K)) as string}") ${ULTRA_RES_K}x`);
    }

    const iSet = `image-set(${[...imgSet].join(', ')})`;
    el.style.setProperty('background-image', iSet);
    el.style.setProperty('background-image', '-webkit-' + iSet);
  }

  getSrcset(): string {
    const srcset = new Set<string>();
    if (this.breakpoints) {
      this.breakpoints.forEach((bp) => {
        srcset.add(`${this._getUrlBase(`${bp}x`) as string} ${this._validateSize(`${bp}w`)}`);
        if (this.$$('hi-res-support')) {
          srcset.add(`${this._getUrlBase(`${bp * HI_RES_K}x`) as string} ${this._validateSize(`${bp * HI_RES_K}w`)}`);
        }
        if (this.$$('ultra-res-support')) {
          srcset.add(
            `${this._getUrlBase(`${bp * ULTRA_RES_K}x`) as string} ${this._validateSize(`${bp * ULTRA_RES_K}w`)}`,
          );
        }
      });
    } else {
      srcset.add(`${this._getUrlBase(this._getElSize(this.currentImg.img)) as string} 1x`);
      if (this.$$('hi-res-support')) {
        srcset.add(`${this._getUrlBase(this._getElSize(this.currentImg.img, 2)) as string} 2x`);
      }
      if (this.$$('ultra-res-support')) {
        srcset.add(`${this._getUrlBase(this._getElSize(this.currentImg.img, 3)) as string} 3x`);
      }
    }
    return [...srcset].join();
  }

  getSrc(): string | undefined {
    return this._getUrlBase();
  }

  get srcUrlPreview(): string | undefined {
    return this._getUrlBase('100x', '100');
  }

  renderBackground(): void {
    const selector = this.bgSelector as string;
    [...document.querySelectorAll(selector)].forEach((el) => {
      if (this.$$('intersection')) {
        this.initIntersection(el as HTMLElement, () => {
          this.renderBg(el as HTMLElement);
        });
      } else {
        this.renderBg(el as HTMLElement);
      }
    });
  }

  private _appendURL({ elNode, src, srcset }: AppendUrlParams): void {
    if (src) {
      elNode.src = src;
    }

    if (srcset) {
      elNode.srcset = srcset;
    }
  }

  private _setupConfigForImage({ elNode }: ConfigImageParams): void {
    this._setupEventProxy(elNode);
    this.initAttributes(elNode);
  }

  loaderImage({ src, srcset, elNode }: LoaderParams): Promise<HTMLImageElement> {
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

  async renderImage(): Promise<void> {
    if (this.$$('intersection')) {
      if (this.hasPreviewImage) {
        this._setupConfigForImage({ elNode: this._imgPreview });
        this.appendChild(this._imgPreview);
      }

      this.initIntersection(this.currentImg.img, async () => {
        if (this.hasPreviewImage) {
          this._imgPreview.src = this.srcUrlPreview as string;
        }

        try {
          await this.loaderImage({
            src: this.getSrc(),
            srcset: this.getSrcset(),
            elNode: this._img,
          });

          if (this.hasPreviewImage) {
            await this._imgPreview.remove();
          }

          this.appendChild(this._img);
        } catch {
          if (this.hasPreviewImage) {
            await this._imgPreview?.remove();
          }
          this.appendChild(this._img);
        }
      });

      return;
    }

    try {
      if (this.hasPreviewImage) {
        await this.loaderImage({
          src: this.srcUrlPreview,
          elNode: this._imgPreview,
        });

        this.appendChild(this._imgPreview);
      }

      await this.loaderImage({
        src: this.getSrc(),
        srcset: this.getSrcset(),
        elNode: this._img,
      });

      if (this.hasPreviewImage) {
        await this._imgPreview?.remove();
      }

      this.appendChild(this._img);
    } catch {
      if (this.hasPreviewImage) {
        await this._imgPreview?.remove();
      }
      this.appendChild(this._img);
    }
  }

  init(): void {
    if (this.bgSelector) {
      this.renderBackground();
    } else {
      this.renderImage();
    }
  }
}
