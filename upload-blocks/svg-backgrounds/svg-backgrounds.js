const dataPrefix = 'data:image/svg+xml;base64,';

/**
 * @param {String} [color1]
 * @param {String} [color2]
 * @returns {String}
 */
export function checkerboardCssBg(color1 = '#fff', color2 = 'rgba(0, 0, 0, .1)') {
  return (
    dataPrefix +
    btoa(/*svg*/ `<svg height="20" width="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="20" height="20" fill="${color1}" />
    <rect x="0" y="0" width="10" height="10" fill="${color2}" />
    <rect x="10" y="10" width="10" height="10" fill="${color2}" />
  </svg>`)
  );
}

/**
 * @param {String} [color]
 * @returns {String}
 */
export function strokesCssBg(color = 'rgba(0, 0, 0, .1)') {
  return (
    dataPrefix +
    btoa(/*svg*/ `<svg height="10" width="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="10" x2="10" y2="0" stroke="${color}" />
  </svg>`)
  );
}
