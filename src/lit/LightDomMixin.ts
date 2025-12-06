import { html, type LitElement, type PropertyValues } from 'lit';
import type { Constructor } from './Constructor';

type AdoptedNode = ChildNode & { contentFor?: string };

declare class LightDomElementInterface {
  public willYield: boolean;
  public yield(slot: string, defaultContent?: unknown): unknown;
}

export function LightDomMixin<T extends Constructor<LitElement>>(ctor: T): T & Constructor<LightDomElementInterface> {
  abstract class LightDomMixinClass extends ctor {
    // Set this to true to adopt children before the first update when multiple slots are expected.
    public willYield = true;

    private _slotsMap: Record<string, AdoptedNode[] | undefined> = {};
    private _initialLightDomChildren: AdoptedNode[] | null = null;
    private _hasAdoptedChildren = false;

    public override createRenderRoot(): HTMLElement | ShadowRoot {
      return this;
    }

    public override connectedCallback(): void {
      if (!this._initialLightDomChildren) {
        this._initialLightDomChildren = Array.from(this.childNodes) as AdoptedNode[];
      }
      super.connectedCallback();
    }

    private _adoptChildren(): void {
      if (this._hasAdoptedChildren) {
        return;
      }

      this._hasAdoptedChildren = true;
      this._slotsMap = {};

      const directChildren = Array.from(this.childNodes) as AdoptedNode[];
      const nodesToProcess = directChildren.length ? directChildren : (this._initialLightDomChildren ?? []);

      for (const child of nodesToProcess) {
        const slotName = this._getSlotNameForChild(child);
        const slotContent = this._slotsMap[slotName] ?? [];

        if (child instanceof Element) {
          child.removeAttribute('slot');
          child.removeAttribute('content-for');
        }

        slotContent.push(child);
        this._slotsMap[slotName] = slotContent;
      }

      this._initialLightDomChildren = null;
    }

    private _getSlotNameForChild(child: AdoptedNode): string {
      // Both Angular and AngularJS will decorate nodes with comments when they
      // compile their template expressions. When we see a comment directly before
      // an element look ahead to find the slot.
      if (child instanceof Comment && child.nextSibling instanceof Element) {
        return this._getSlotNameForChild(child.nextSibling);
      }

      if ('contentFor' in child) {
        return child.contentFor || '';
      }

      if (child instanceof Element && child.hasAttribute('content-for')) {
        return child.getAttribute('content-for') || '';
      }

      return '';
    }

    private _isTextNodeEmpty(node: Text): boolean {
      return !node.textContent || !node.textContent.trim();
    }

    // I'm not sure what the behavior here should be. If there is an expression
    // but it evaluates to nothing being rendered is the slot empty or not? I'm
    // inclined to think that it is not empty; however, I'm not sure how to deal
    // with the fact that lit-html inserts a bunch of empty text placeholder
    // nodes.
    private _isSlotEmpty(slot: string): boolean {
      const content = this._slotsMap[slot];

      return (
        !content ||
        content.every((child) => {
          return child instanceof Comment || (child instanceof Text && this._isTextNodeEmpty(child));
        })
      );
    }

    // Adopting children needs to happen here, opposed to connectedCallback,
    // otherwise AngularJS template expressions will not work. You may think that
    // beating all frameworks to the childNodes would be the answer but Angular,
    // for example, will pre-compile the templates. So it is impossible to beat
    // Angular to the childNodes.
    public override update(changedProperties: PropertyValues<this>) {
      if (!this.hasUpdated && this.willYield) {
        this._adoptChildren();
      }

      super.update(changedProperties);
    }

    public yield(slot: string, defaultContent?: unknown) {
      if (slot === '' && !this._slotsMap[slot] && !this._hasAdoptedChildren && this._initialLightDomChildren?.length) {
        const slotContent: AdoptedNode[] = [];

        for (const child of this._initialLightDomChildren) {
          if (child instanceof Element) {
            child.removeAttribute('slot');
            child.removeAttribute('content-for');
          }
          slotContent.push(child);
        }

        this._slotsMap[slot] = slotContent;
        this._hasAdoptedChildren = true;
        this._initialLightDomChildren = null;
      }

      const slotContent = this._slotsMap[slot];

      return html`
      ${slotContent}
      ${this._isSlotEmpty(slot) ? defaultContent : undefined}
    `;
    }
  }

  return LightDomMixinClass as unknown as Constructor<LightDomElementInterface> & T;
}
