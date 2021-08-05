import { UC_ICONS } from './icon-set.js';

/** @typedef {10 | 20 | 30 | 40} IconSize */

/**
 * @param {String} markup
 * @param {IconSize} viewBoxWidth
 * @param {IconSize} viewBoxHeight
 * @param {IconSize} svgWidth
 * @param {IconSize} svgHeight
 */
function iconHtml(markup, viewBoxWidth, viewBoxHeight, svgWidth, svgHeight) {
  return /*html*/ `<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}"
    height="${svgWidth}"
    width="${svgHeight}"
  >${markup}</svg>`;
}

/**
 * @param {string} path
 * @returns {string}
 */
function singlePath(path) {
  return /* html */ `
    <path stroke-linejoin="round" fill="none" stroke="currentColor" stroke-width="1.2" d="${path}" />
  `;
}

/**
 * @param {keyof typeof UC_ICONS} name
 * @param {IconSize} [width]
 * @param {IconSize} [height]
 */
export function ucIconHtml(name, width, height) {
  let { w, g, p } = UC_ICONS[name];
  let markup = p ? singlePath(p) : g;

  return iconHtml(markup, w, w, width || w, height || width || w);
}
