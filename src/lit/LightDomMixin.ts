import { html, type LitElement, type PropertyValues } from 'lit';
import type { Constructor } from './Constructor';

declare class LightDomElementInterface {
  public yield(slot: string, defaultContent?: unknown): unknown;
}

export function LightDomMixin<T extends Constructor<LitElement>>(ctor: T): T & Constructor<LightDomElementInterface> {
  abstract class LightDomMixinClass extends ctor {
    private _slotsMap: Record<string, ChildNode[] | undefined> = {};
    private _initialLightDomChildren: ChildNode[] | null = null;
    private _hasAdoptedChildren = false;

    public override createRenderRoot(): HTMLElement | ShadowRoot {
      return this;
    }

    public override connectedCallback(): void {
      if (!this._initialLightDomChildren) {
        this._initialLightDomChildren = Array.from(this.childNodes) as ChildNode[];
      }
      super.connectedCallback();
    }

    private _adoptChildren(): void {
      if (this._hasAdoptedChildren) {
        return;
      }

      this._hasAdoptedChildren = true;
      this._slotsMap = {};

      for (const child of this._initialLightDomChildren ?? []) {
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

    private _getSlotNameForChild(child: ChildNode): string {
      // Both Angular and AngularJS will decorate nodes with comments when they
      // compile their template expressions. When we see a comment directly before
      // an element look ahead to find the slot.
      if (child instanceof Comment && child.nextSibling instanceof Element) {
        return this._getSlotNameForChild(child.nextSibling);
      }

      return (child instanceof Element && child.getAttribute('content-for')) || '';
    }

    // Comments and whitespace-only text count as empty, so a slot whose content is
    // only framework markers (Angular comments, lit-html placeholders) shows the default.
    private _isSlotEmpty(slot: string): boolean {
      const content = this._slotsMap[slot];

      return (
        !content ||
        content.every((child) => {
          return child instanceof Comment || (child instanceof Text && !child.textContent?.trim());
        })
      );
    }

    // The children are read at the first update, not in connectedCallback, otherwise
    // AngularJS template expressions will not work: Angular pre-compiles its templates,
    // so there is no beating it to the childNodes. They are sorted into slots only on
    // the first yield, so a block that never yields leaves them alone; reading them
    // here keeps a later first yield from picking up this block's own rendered output.
    public override update(changedProperties: PropertyValues<this>) {
      if (!this.hasUpdated && this.childNodes.length) {
        this._initialLightDomChildren = Array.from(this.childNodes) as ChildNode[];
      }

      super.update(changedProperties);
    }

    public yield(slot: string, defaultContent?: unknown) {
      this._adoptChildren();
      const slotContent = this._slotsMap[slot];

      return html`
      ${slotContent}
      ${this._isSlotEmpty(slot) ? defaultContent : undefined}
    `;
    }
  }

  return LightDomMixinClass as unknown as Constructor<LightDomElementInterface> & T;
}
