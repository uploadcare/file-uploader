import { html, type TemplateResult } from 'lit';

export function renderIconSvg(href: string): TemplateResult {
  return html`<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><use href=${href}></use></svg>`;
}
