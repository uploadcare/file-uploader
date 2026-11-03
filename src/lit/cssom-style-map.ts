import { noChange } from 'lit';
import { type AttributePart, Directive, directive, type PartInfo, PartType } from 'lit/directive.js';
import { applyStyles } from '../utils/applyStyles';

type StyleInfo = Record<string, string | number>;

/**
 * `styleMap` for a page under a CSP without `'unsafe-inline'`, which drops every `style` attribute. Lit's `styleMap`
 * writes its first render as that attribute; this one writes every render through `el.style`, which the policy allows.
 * Pass the same keys on every render: one left out is not removed.
 */
class CssomStyleMapDirective extends Directive {
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
    applyStyles(part.element, styles);
    return noChange;
  }
}

export const cssomStyleMap = directive(CssomStyleMapDirective);
