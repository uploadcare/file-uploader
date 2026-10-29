import { modifiers, serializeOperations, unsafeOperation } from '@uploadcare/cdn-url';
import { LitElement } from 'lit';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../env.js';
import { RegisterableElementMixin } from '../../lit/RegisterableElementMixin.js';
import { operationsFromModifiers } from '../../utils/cdn/operations';
import { CSS_PREF } from './configurations.js';
import { parseCssPropertyValue } from './parseCssPropertyValue';
import { type ImgPropKey, PROPS_MAP } from './props-map.js';

export type CssPropValue = string | number | undefined | null;
type CssPropRecord = Record<string, CssPropValue>;
type PropConfig = { default?: CssPropValue };

export class ImgConfig extends RegisterableElementMixin(LitElement) {
  private _state: CssPropRecord = {};
  private _subscribers: Map<string, Set<(val: CssPropValue) => void>> = new Map();
  private _isnObserver: IntersectionObserver | null = null;

  public override createRenderRoot(): HTMLElement | ShadowRoot {
    return this;
  }

  public constructor() {
    super();
    for (const prop in PROPS_MAP) {
      this._state[CSS_PREF + prop] = (PROPS_MAP[prop as ImgPropKey] as PropConfig).default || '';
    }
  }

  protected $$(key: ImgPropKey): CssPropValue {
    return this._state[CSS_PREF + key];
  }

  protected sub$$(key: ImgPropKey, kbFn: (val: CssPropValue) => void): void {
    const fullKey = CSS_PREF + key;
    if (!this._subscribers.has(fullKey)) {
      this._subscribers.set(fullKey, new Set());
    }
    this._subscribers.get(fullKey)?.add(kbFn);

    const currentVal = this._state[fullKey];
    if (currentVal !== null && currentVal !== '') {
      kbFn(currentVal);
    }
  }

  private _notify(key: string, val: CssPropValue) {
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
    // `ImgBase`'s `_getCdnOperationFragments` pipeline
    // stays string-based (it also carries user-supplied `cdn-operations`
    // fragments, which must stay parsed strings — see AGENTS.md scope note).
    // Threading a `CdnOperation` through it would mean restructuring that
    // pipeline, so the operation is still authored structurally here — via
    // `unsafeOperation`, the escape hatch for the internal `@clib` directive
    // `OperationLiteral` cannot express — and serialised at this boundary.
    return serializeOperations(
      operationsFromModifiers(modifiers(unsafeOperation(`@clib/${PACKAGE_NAME}/${PACKAGE_VERSION}/uc-img`))),
    );
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
    this._isnObserver = new IntersectionObserver((entries) => {
      entries.forEach((ent) => {
        if (ent.isIntersecting) {
          cbkFn();
          this._isnObserver?.unobserve(el);
        }
      });
    });
    this._isnObserver.observe(el);
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    this._initCssProperties();
  }

  private _initCssProperties(): void {
    const style = window.getComputedStyle(this);
    for (const prop in PROPS_MAP) {
      const fullKey = CSS_PREF + prop;
      let val: ReturnType<typeof parseCssPropertyValue> = null;
      try {
        val = parseCssPropertyValue(style.getPropertyValue(fullKey).trim());
      } catch {
        // An unparseable value is skipped, like an unset one.
      }
      if (val !== null && val !== undefined) {
        this._state[fullKey] = val as CssPropValue;
      }
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._isnObserver?.disconnect();
    this._isnObserver = null;
    this._subscribers.clear();
  }

  public static override get observedAttributes(): string[] {
    return Object.keys(PROPS_MAP);
  }

  public override attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null): void {
    window.setTimeout(() => {
      const fullKey = CSS_PREF + name;
      // NEXT-MAJOR(uc-img): read the number flags' attribute values as numbers, so `is-preview-blur="0"` switches the
      // flag off (6ed31267 did, and fixed the preview it then left on screen). Strings, as in v1, kept for 1.x compat.
      this._state[fullKey] = newVal;
      this._notify(fullKey, newVal);
    });
  }
}
