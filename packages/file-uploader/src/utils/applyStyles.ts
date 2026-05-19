export function applyStyles<T extends SVGElement | HTMLElement>(
  el: T,
  styleMap: Record<string, string | number>,
): void {
  for (const prop in styleMap) {
    if (prop.includes('-')) {
      el.style.setProperty(prop, String(styleMap[prop]));
    } else {
      (el.style as CSSStyleDeclaration & Record<string, string>)[prop] = String(styleMap[prop]);
    }
  }
}
