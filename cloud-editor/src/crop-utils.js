import { THUMB_CORNER_SIZE, THUMB_OFFSET, THUMB_SIDE_SIZE } from './cropper-constants.js';

/**
 * @param {SVGElement} node
 * @param {{ [key: string]: string | number }} attrs
 */
export function setSvgNodeAttrs(node, attrs) {
  for (let p in attrs) node.setAttributeNS(null, p, attrs[p].toString());
}

/**
 * @param {string} name
 * @param {{ [key: string]: string | number }} attrs
 * @returns {SVGElement}
 */
export function createSvgNode(name, attrs = {}) {
  let node = document.createElementNS('http://www.w3.org/2000/svg', name);
  setSvgNodeAttrs(node, attrs);
  return node;
}

/**
 * @param {import('./EditorImageCropper.js').Rectangle} rect
 * @param {string} direction
 */
export function cornerPath(rect, direction) {
  let { x, y, width, height } = rect;

  let wMul = direction.includes('w') ? 0 : 1;
  let hMul = direction.includes('n') ? 0 : 1;
  let xSide = [-1, 1][wMul];
  let ySide = [-1, 1][hMul];

  let p1 = [
    x + wMul * width + THUMB_OFFSET * xSide,
    y + hMul * height + THUMB_OFFSET * ySide - THUMB_CORNER_SIZE * ySide,
  ];
  let p2 = [x + wMul * width + THUMB_OFFSET * xSide, y + hMul * height + THUMB_OFFSET * ySide];
  let p3 = [
    x + wMul * width - THUMB_CORNER_SIZE * xSide + THUMB_OFFSET * xSide,
    y + hMul * height + THUMB_OFFSET * ySide,
  ];

  let path = `M ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]}`;
  let center = p2;

  return {
    d: path,
    center,
  };
}

/**
 * @param {import('./EditorImageCropper.js').Rectangle} rect
 * @param {string} direction
 */
export function sidePath(rect, direction) {
  let { x, y, width, height } = rect;

  let wMul = ['n', 's'].includes(direction) ? 0.5 : { w: 0, e: 1 }[direction];
  let hMul = ['w', 'e'].includes(direction) ? 0.5 : { n: 0, s: 1 }[direction];
  let xSide = [-1, 1][wMul];
  let ySide = [-1, 1][hMul];

  let p1, p2;
  if (['n', 's'].includes(direction)) {
    p1 = [x + wMul * width - THUMB_SIDE_SIZE / 2, y + hMul * height + THUMB_OFFSET * ySide];
    p2 = [x + wMul * width + THUMB_SIDE_SIZE / 2, y + hMul * height + THUMB_OFFSET * ySide];
  } else {
    p1 = [x + wMul * width + THUMB_OFFSET * xSide, y + hMul * height - THUMB_SIDE_SIZE / 2];
    p2 = [x + wMul * width + THUMB_OFFSET * xSide, y + hMul * height + THUMB_SIDE_SIZE / 2];
  }
  let path = `M ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]}`;
  let center = [p2[0] - (p2[0] - p1[0]) / 2, p2[1] - (p2[1] - p1[1]) / 2];

  return { d: path, center };
}

/** @param {string} direction */
export function thumbCursor(direction) {
  if (direction === '') {
    return 'move';
  }
  if (['e', 'w'].includes(direction)) {
    return 'ew-resize';
  }
  if (['n', 's'].includes(direction)) {
    return 'ns-resize';
  }
  if (['nw', 'se'].includes(direction)) {
    return 'nwse-resize';
  }
  return 'nesw-resize';
}

/**
 * @param {import('./EditorImageCropper.js').Rectangle} rect
 * @param {[number, number]} delta
 */
export function moveRect(rect, [dx, dy]) {
  return {
    ...rect,
    x: rect.x + dx,
    y: rect.y + dy,
  };
}

/**
 * @param {import('./EditorImageCropper.js').Rectangle} rect1
 * @param {import('./EditorImageCropper.js').Rectangle} rect2
 */
export function constraintRect(rect1, rect2) {
  let { x } = rect1;
  let { y } = rect1;
  if (rect1.x < rect2.x) {
    x = rect2.x;
  } else if (rect1.x + rect1.width > rect2.x + rect2.width) {
    x = rect2.x + rect2.width - rect1.width;
  }
  if (rect1.y < rect2.y) {
    y = rect2.y;
  } else if (rect1.y + rect1.height > rect2.y + rect2.height) {
    y = rect2.y + rect2.height - rect1.height;
  }

  return {
    ...rect1,
    x,
    y,
  };
}

/**
 * @param {import('./EditorImageCropper.js').Rectangle} rect
 * @param {[number, number]} delta
 * @param {string} direction
 */
export function expandRect(rect, [dx, dy], direction) {
  let { x, y, width, height } = rect;

  if (direction.includes('n')) {
    y += dy;
    height -= dy;
  }
  if (direction.includes('s')) {
    height += dy;
  }
  if (direction.includes('w')) {
    x += dx;
    width -= dx;
  }
  if (direction.includes('e')) {
    width += dx;
  }
  return {
    x,
    y,
    width,
    height,
  };
}

/**
 * @param {import('./EditorImageCropper.js').Rectangle} rect1
 * @param {import('./EditorImageCropper.js').Rectangle} rect2
 */
export function intersectionRect(rect1, rect2) {
  let leftX = Math.max(rect1.x, rect2.x);
  let rightX = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
  let topY = Math.max(rect1.y, rect2.y);
  let bottomY = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);

  return { x: leftX, y: topY, width: rightX - leftX, height: bottomY - topY };
}

/**
 * @param {import('./EditorImageCropper.js').Rectangle} rect
 * @param {[number, number]} minSize
 * @param {string} direction
 */
export function minRectSize(rect, [minWidth, minHeight], direction) {
  let { x, y, width, height } = rect;

  if (direction.includes('n')) {
    let prevHeight = height;
    height = Math.max(minHeight, height);
    y = y + prevHeight - height;
  }
  if (direction.includes('s')) {
    height = Math.max(minHeight, height);
  }
  if (direction.includes('w')) {
    let prevWidth = width;
    width = Math.max(minWidth, width);
    x = x + prevWidth - width;
  }
  if (direction.includes('e')) {
    width = Math.max(minWidth, width);
  }

  return { x, y, width, height };
}

/**
 * @param {import('./EditorImageCropper.js').Rectangle} rect
 * @param {[number, number]} point
 */
export function rectContainsPoint(rect, [x, y]) {
  return rect.x <= x && x <= rect.x + rect.width && rect.y <= y && y <= rect.y + rect.height;
}
