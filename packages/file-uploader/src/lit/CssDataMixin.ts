import type { LitElement } from 'lit';
import type { Constructor } from './Constructor';
import { parseCssPropertyValue } from './parseCssPropertyValue';

declare class CssDataMixinClassInterface {
  public getCssData(propName: string, silentCheck?: boolean): string | number | boolean | null | undefined;
}

export function CssDataMixin<T extends Constructor<LitElement>>(ctor: T): T & Constructor<CssDataMixinClassInterface> {
  abstract class CssDataMixinClass extends ctor {
    private _cssDataCache: Record<string, string | number | boolean | null | undefined> | null = null;
    private _computedStyle: CSSStyleDeclaration | null = null;

    public getCssData(propName: string, silentCheck = false): string | number | boolean | null | undefined {
      const cssDataCache = this._cssDataCache ?? Object.create(null);
      if (!Object.keys(cssDataCache).includes(propName) || !cssDataCache[propName]) {
        if (!this._computedStyle) {
          this._computedStyle = window.getComputedStyle(this);
        }
        const val = this._computedStyle.getPropertyValue(propName).trim();
        try {
          cssDataCache[propName] = parseCssPropertyValue(val);
        } catch (error) {
          if (!silentCheck) {
            console.warn(`CSS Data error: ${propName}`, error);
          }
          cssDataCache[propName] = null;
        }
      }
      this._cssDataCache = cssDataCache;
      return cssDataCache[propName];
    }
  }
  return CssDataMixinClass as unknown as T & Constructor<CssDataMixinClassInterface>;
}
