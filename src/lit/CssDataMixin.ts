import type { LitElement } from 'lit';
import type { Constructor } from './Constructor';
import { parseCssPropertyValue } from './parseCssPropertyValue';

declare class CssDataMixinClassInterface {
  getCssData(propName: string, silentCheck?: boolean): string | number | boolean | null | undefined;
}

export function CssDataMixin<T extends Constructor<LitElement>>(ctor: T): T & Constructor<CssDataMixinClassInterface> {
  abstract class CssDataMixinClass extends ctor {
    private cssDataCache: Record<string, string | number | boolean | null | undefined> | null = null;
    private computedStyle: CSSStyleDeclaration | null = null;

    getCssData(propName: string, silentCheck = false): string | number | boolean | null | undefined {
      const cssDataCache = this.cssDataCache ?? Object.create(null);
      if (!Object.keys(cssDataCache).includes(propName) || !cssDataCache[propName]) {
        if (!this.computedStyle) {
          this.computedStyle = window.getComputedStyle(this);
        }
        const val = this.computedStyle.getPropertyValue(propName).trim();
        try {
          cssDataCache[propName] = parseCssPropertyValue(val);
        } catch (error) {
          if (!silentCheck) {
            console.warn(`CSS Data error: ${propName}`, error);
          }
          cssDataCache[propName] = null;
        }
      }
      this.cssDataCache = cssDataCache;
      return cssDataCache[propName];
    }
  }
  return CssDataMixinClass as unknown as T & Constructor<CssDataMixinClassInterface>;
}
