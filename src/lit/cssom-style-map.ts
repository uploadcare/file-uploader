import { noChange } from 'lit';
import { type AttributePart, Directive, directive, type PartInfo, PartType } from 'lit/directive.js';
import { setStyle } from '../utils/applyStyles';

type StyleInfo = Readonly<Record<string, string | number | null | undefined>>;

/**
 * `styleMap` for a page under a CSP without `'unsafe-inline'`, which drops every `style` attribute. Lit's `styleMap`
 * writes its first render as that attribute; this one writes every render through `el.style`, which the policy allows.
 * Like `styleMap`, a `null`/`undefined` value or a key left out since the last render removes that property.
 */
class CssomStyleMapDirective extends Directive {
  private _previous = new Set<string>();

  public constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ATTRIBUTE || partInfo.name !== 'style') {
      throw new Error('`cssomStyleMap` must be used as the whole `style` attribute.');
    }
  }

  public render(_styles: StyleInfo): typeof noChange {
    return noChange;
  }

  public override update(part: AttributePart, [styles]: [StyleInfo]): typeof noChange {
    const { style } = part.element;
    const current = new Set<string>();
    for (const [prop, value] of Object.entries(styles)) {
      if (value == null) continue;
      current.add(prop);
      setStyle(style, prop, String(value));
    }
    for (const prop of this._previous) {
      // An empty value removes the property.
      if (!current.has(prop)) setStyle(style, prop, '');
    }
    this._previous = current;
    return noChange;
  }
}

export const cssomStyleMap = directive(CssomStyleMapDirective);
