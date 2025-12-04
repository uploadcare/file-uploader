import { html, type LitElement, type PropertyValues } from 'lit';
import type { Constructor } from './Constructor';

type AdoptedNode = ChildNode & { contentFor?: string };

declare class LightDomElementInterface {
  yield(slot: string, defaultContent?: unknown): unknown;
}

export function LightDomMixin<T extends Constructor<LitElement>>(ctor: T): T & Constructor<LightDomElementInterface> {
  abstract class LightDomMixinClass extends ctor {
    __slots: Record<string, AdoptedNode[] | undefined> = {};

    // Set this to true to adopt children before the first update when multiple slots are expected.
    __willYield = true;

    __initialLightDomChildren: AdoptedNode[] | null = null;
    __hasAdoptedChildren = false;

    override createRenderRoot(): HTMLElement | ShadowRoot {
      return this;
    }

    override connectedCallback(): void {
      if (!this.__initialLightDomChildren) {
        this.__initialLightDomChildren = Array.from(this.childNodes) as AdoptedNode[];
      }
      super.connectedCallback();
    }

    __adoptChildren(): void {
      if (this.__hasAdoptedChildren) {
        return;
      }

      this.__hasAdoptedChildren = true;
      this.__slots = {};

      const directChildren = Array.from(this.childNodes) as AdoptedNode[];
      const nodesToProcess = directChildren.length ? directChildren : (this.__initialLightDomChildren ?? []);

      for (const child of nodesToProcess) {
        const slotName = this.__getSlotNameForChild(child);
        const slotContent = this.__slots[slotName] ?? [];

        if (child instanceof Element) {
          child.removeAttribute('slot');
          child.removeAttribute('content-for');
        }

        slotContent.push(child);
        this.__slots[slotName] = slotContent;
      }

      this.__initialLightDomChildren = null;
    }

    __getSlotNameForChild(child: AdoptedNode): string {
      // Both Angular and AngularJS will decorate nodes with comments when they
      // compile their template expressions. When we see a comment directly before
      // an element look ahead to find the slot.
      if (child instanceof Comment && child.nextSibling instanceof Element) {
        return this.__getSlotNameForChild(child.nextSibling);
      }

      if ('contentFor' in child) {
        return child.contentFor || '';
      }

      if (child instanceof Element && child.hasAttribute('content-for')) {
        return child.getAttribute('content-for') || '';
      }

      return '';
    }

    __isTextNodeEmpty(node: Text): boolean {
      return !node.textContent || !node.textContent.trim();
    }

    // I'm not sure what the behavior here should be. If there is an expression
    // but it evaluates to nothing being rendered is the slot empty or not? I'm
    // inclined to think that it is not empty; however, I'm not sure how to deal
    // with the fact that lit-html inserts a bunch of empty text placeholder
    // nodes.
    __isSlotEmpty(slot: string): boolean {
      const content = this.__slots[slot];

      return (
        !content ||
        content.every((child) => {
          return child instanceof Comment || (child instanceof Text && this.__isTextNodeEmpty(child));
        })
      );
    }

    // Adopting children needs to happen here, opposed to connectedCallback,
    // otherwise AngularJS template expressions will not work. You may think that
    // beating all frameworks to the childNodes would be the answer but Angular,
    // for example, will pre-compile the templates. So it is impossible to beat
    // Angular to the childNodes.
    override update(changedProperties: PropertyValues) {
      if (!this.hasUpdated && this.__willYield) {
        this.__adoptChildren();
      }

      super.update(changedProperties);
    }

    yield(slot: string, defaultContent?: unknown) {
      if (slot === '' && !this.__slots[slot] && !this.__hasAdoptedChildren && this.__initialLightDomChildren?.length) {
        const slotContent: AdoptedNode[] = [];

        for (const child of this.__initialLightDomChildren) {
          if (child instanceof Element) {
            child.removeAttribute('slot');
            child.removeAttribute('content-for');
          }
          slotContent.push(child);
        }

        this.__slots[slot] = slotContent;
        this.__hasAdoptedChildren = true;
        this.__initialLightDomChildren = null;
      }

      const slotContent = this.__slots[slot];

      return html`
      ${slotContent}
      ${this.__isSlotEmpty(slot) ? defaultContent : undefined}
    `;
    }
  }

  return LightDomMixinClass as unknown as Constructor<LightDomElementInterface> & T;
}
