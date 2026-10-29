import { html } from 'lit';

import './Icon';

const SIZE_RECT_FIXED = 12;
const SIZE_SVG_WRAPPER = 16;

/** The rectangle for a `width`:`height` shape, its longer side fixed. */
const fitRect = (width: number, height: number) =>
  width >= height
    ? { width: SIZE_RECT_FIXED, height: Math.round((SIZE_RECT_FIXED * height) / width) }
    : { width: Math.round((SIZE_RECT_FIXED * width) / height), height: SIZE_RECT_FIXED };

/** An icon of a `width`:`height` shape: a rounded outline of it, centered. */
export const renderAspectRatioIcon = (width: number, height: number) => {
  const rect = fitRect(width, height);
  const x = (SIZE_SVG_WRAPPER - rect.width) / 2;
  const y = (SIZE_SVG_WRAPPER - rect.height) / 2;

  return html`
    <uc-icon>
      <svg viewBox="0 0 ${SIZE_SVG_WRAPPER} ${SIZE_SVG_WRAPPER}" aria-hidden="true" focusable="false">
        <rect
          x=${x}
          y=${y}
          width=${rect.width}
          height=${rect.height}
          rx="2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linejoin="round"
        ></rect>
      </svg>
    </uc-icon>
  `;
};
