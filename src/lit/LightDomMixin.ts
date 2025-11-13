import type { LitElement } from 'lit';
import type { LitCtor } from './LitCtor';

/**
 * LightDomMixin - Renders content to Light DOM instead of Shadow DOM
 * 
 * Usage:
 * @LightDomMixin
 * class MyComponent extends LitElement { ... }
 */
export function LightDomMixin<T extends LitCtor<LitElement>>(ctor: T) {
  abstract class LightDomMixinClass extends ctor {
    protected override createRenderRoot(): HTMLElement | ShadowRoot {
      return this;
    }
  }

  return LightDomMixinClass;
}
