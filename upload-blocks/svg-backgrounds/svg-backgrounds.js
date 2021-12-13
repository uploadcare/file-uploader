/**
 * @param {String} svg
 * @returns {String}
 */
function createSvgBlobUrl(svg) {
  let blob = new Blob([svg], {
    type: 'image/svg+xml',
  });
  return URL.createObjectURL(blob);
}

/**
 * @param {String} [color1]
 * @param {String} [color2]
 * @returns {String}
 */
export function checkerboardCssBg(color1 = '#fff', color2 = 'rgba(0, 0, 0, .1)') {
  return createSvgBlobUrl(/*svg*/ `<svg height="20" width="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="20" height="20" fill="${color1}" />
    <rect x="0" y="0" width="10" height="10" fill="${color2}" />
    <rect x="10" y="10" width="10" height="10" fill="${color2}" />
  </svg>`);
}

/**
 * @param {String} [color]
 * @returns {String}
 */
export function strokesCssBg(color = 'rgba(0, 0, 0, .1)') {
  return createSvgBlobUrl(/*svg*/ `<svg height="10" width="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="10" x2="10" y2="0" stroke="${color}" />
  </svg>`);
}

/**
 * @param {String} [color]
 * @returns {String}
 */
export function fileCssBg(color = 'hsl(0, 0%, 100%)') {
  return createSvgBlobUrl(/*svg*/ `
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.5 28L25.5 27.9997V29.0024L10.5 29.0027V28Z" fill="black" fill-opacity="0.06"/>
    <path d="M9.5 7.50029L21.25 7.5L26.5 12.75V28.4998L9.5 28.5001V7.50029Z" fill="black" fill-opacity="0.06"/>
    <path d="M10 8.00298L21 8.00269L26 12.9998V28.0025L10 28.0027V8.00298Z" fill="${color}"/>
    <path d="M10 8.00298L21 8.00269L26 12.9998V28.0025L10 28.0027V8.00298Z" fill="url(#paint0_linear_2735_2136)"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M20.793 8.50269L10.5 8.50296V27.5027L25.5 27.5025V13.2069L20.793 8.50269ZM21 8.00269L10 8.00298V28.0027L26 28.0025V12.9998L21 8.00269Z" fill="url(#paint1_radial_2735_2136)"/>
    <path d="M21 8L26 13V14H20V8H21Z" fill="black" fill-opacity="0.03"/>
    <path d="M21 8L26 13V13.5H20.5V8H21Z" fill="black" fill-opacity="0.08"/>
    <path d="M21 8L26 13H21V8Z" fill="${color}"/>
    <path d="M21 8L26 13H21V8Z" fill="url(#paint2_linear_2735_2136)"/>
    <path d="M21 8L26 13H21V8Z" fill="url(#paint3_linear_2735_2136)"/>
    <path d="M21.5 8.5L21 8V13H26L25.5 12.5H21.5V8.5Z" fill="url(#paint4_linear_2735_2136)"/>
    <defs>
      <linearGradient id="paint0_linear_2735_2136" x1="18" y1="8" x2="18" y2="28.0027" gradientUnits="userSpaceOnUse">
        <stop stop-color="white" stop-opacity="0.06"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="paint1_radial_2735_2136" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(10 11) rotate(53.7462) scale(18.6011 18.0323)">
        <stop stop-color="white" stop-opacity="0.12"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="paint2_linear_2735_2136" x1="21" y1="13" x2="23.5" y2="10.5" gradientUnits="userSpaceOnUse">
        <stop offset="0.40625" stop-opacity="0"/>
        <stop offset="1" stop-opacity="0.04"/>
      </linearGradient>
      <linearGradient id="paint3_linear_2735_2136" x1="21" y1="13" x2="23.5" y2="10.5" gradientUnits="userSpaceOnUse">
        <stop stop-color="white" stop-opacity="0.16"/>
        <stop offset="1" stop-color="white" stop-opacity="0.06"/>
      </linearGradient>
      <linearGradient id="paint4_linear_2735_2136" x1="21" y1="13" x2="23.5" y2="10.5" gradientUnits="userSpaceOnUse">
        <stop stop-color="white" stop-opacity="0.15"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>
</svg>
  `);
}
