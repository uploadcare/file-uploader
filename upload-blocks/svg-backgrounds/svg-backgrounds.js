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
    <svg width="36" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g filter="url(#a)">
        <path d="m10 8.00298 11-.00029 5 4.99711v15.0027l-16 .0002V8.00298Z" fill="${color}"/>
      </g>
      <g filter="url(#b)">
        <path d="m21 8 5 5h-5V8Z" fill="${color}"/>
      </g>
      <defs>
        <filter id="a" x="8" y="6.50269" width="20" height="24" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix"/>
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
          <feOffset dy=".5"/>
          <feGaussianBlur stdDeviation="1"/>
          <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.18 0"/>
          <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_2684_2129"/>
          <feBlend in="SourceGraphic" in2="effect1_dropShadow_2684_2129" result="shape"/>
        </filter>
        <filter id="b" x="19" y="7" width="8" height="8" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix"/>
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
          <feOffset dx="-.5" dy=".5"/>
          <feGaussianBlur stdDeviation=".75"/>
          <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 0"/>
          <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_2684_2129"/>
          <feBlend in="SourceGraphic" in2="effect1_dropShadow_2684_2129" result="shape"/>
        </filter>
      </defs>
    </svg>`);
}
