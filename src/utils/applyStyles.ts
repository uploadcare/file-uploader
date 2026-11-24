export const setStyle = (style: CSSStyleDeclaration, prop: string, value: string): void => {
  if (prop.includes('-')) {
    style.setProperty(prop, value);
  } else {
    (style as CSSStyleDeclaration & Record<string, string>)[prop] = value;
  }
};

export function applyStyles<T extends SVGElement | HTMLElement>(
  el: T,
  styleMap: Record<string, string | number>,
): void {
  for (const prop in styleMap) {
    setStyle(el.style, prop, String(styleMap[prop]));
  }
}
