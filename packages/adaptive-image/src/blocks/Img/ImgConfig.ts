import { LitElement } from 'lit';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../env.js';
import { CssDataMixin } from '../../lit/CssDataMixin.js';
import { RegisterableElementMixin } from '../../lit/RegisterableElementMixin.js';
import { CSS_PREF } from './configurations.js';
import { PROPS_MAP } from './props-map.js';

type CssPropValue = string | number | undefined | null;
type CssPropRecord = Record<string, CssPropValue>;
type PropConfig = { default?: CssPropValue } | Record<string, never>;

export class ImgConfig extends CssDataMixin(RegisterableElementMixin(LitElement)) {
  private _state: CssPropRecord = {};
  private _subscribers: Map<string, Set<(val: unknown) => void>> = new Map();
  private _isnObserver: IntersectionObserver | null = null;
  private _observed: Set<Element> | null = null;

  public override createRenderRoot(): HTMLElement | ShadowRoot {
    return this;
  }

  public constructor() {
    super();
    for (const prop in PROPS_MAP) {
      const config = PROPS_MAP[prop as keyof typeof PROPS_MAP] as PropConfig | undefined;
      this._state[CSS_PREF + prop] = (config as { default?: CssPropValue })?.default || '';
    }
  }

  protected $$(key: string): unknown {
    return this._state[CSS_PREF + key];
  }

  protected set$$(kvObj: Record<string, CssPropValue>): void {
    for (const key in kvObj) {
      const fullKey = CSS_PREF + key;
      const val = kvObj[key];
      this._state[fullKey] = val;
      this._notify(fullKey, val);
    }
  }

  protected sub$$<T = unknown>(key: string, kbFn: (val: T) => void): void {
    const fullKey = CSS_PREF + key;
    if (!this._subscribers.has(fullKey)) {
      this._subscribers.set(fullKey, new Set());
    }
    this._subscribers.get(fullKey)?.add(kbFn as any);

    const currentVal = this._state[fullKey];
    if (currentVal !== null && currentVal !== '') {
      kbFn(currentVal as T);
    }
  }

  private _notify(key: string, val: unknown) {
    if (this._subscribers.has(key)) {
      this._subscribers.get(key)?.forEach((cb) => {
        if (val === null || val === '') {
          return;
        }
        cb(val);
      });
    }
  }

  protected analyticsParams(): string {
    return `-/@clib/${PACKAGE_NAME}/${PACKAGE_VERSION}/uc-img/`;
  }

  protected initAttributes(el: HTMLElement): void {
    Array.from(this.attributes).forEach((attr) => {
      const currentAttr = attr as Attr;
      if (!PROPS_MAP[currentAttr.name as keyof typeof PROPS_MAP]) {
        el.setAttribute(currentAttr.name, currentAttr.value);
      }
    });
  }

  protected initIntersection(el: HTMLElement, cbkFn: () => void): void {
    const opts: IntersectionObserverInit = {
      root: null,
      rootMargin: '0px',
    };
    this._isnObserver = new IntersectionObserver((entries) => {
      entries.forEach((ent) => {
        if (ent.isIntersecting) {
          cbkFn();
          this._isnObserver?.unobserve(el);
        }
      });
    }, opts);
    this._isnObserver.observe(el);
    if (!this._observed) {
      this._observed = new Set();
    }
    this._observed.add(el);
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    this._initCssProperties();
  }

  private _initCssProperties(): void {
    for (const prop in PROPS_MAP) {
      const fullKey = CSS_PREF + prop;
      const val = this.getCssData(fullKey, true);
      if (val !== null && val !== undefined) {
        this._state[fullKey] = val as CssPropValue;
      }
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._isnObserver) {
      this._observed?.forEach((el) => {
        this._isnObserver?.unobserve(el);
      });
      this._isnObserver = null;
    }
    this._subscribers.clear();
  }

  public static override get observedAttributes(): string[] {
    return Object.keys(PROPS_MAP);
  }

  public override attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null): void {
    window.setTimeout(() => {
      const fullKey = CSS_PREF + name;
      this._state[fullKey] = newVal;
      this._notify(fullKey, newVal);
    });
  }
}
