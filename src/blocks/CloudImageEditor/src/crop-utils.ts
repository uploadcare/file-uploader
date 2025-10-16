import { MIN_CROP_SIZE, THUMB_CORNER_SIZE, THUMB_OFFSET, THUMB_SIDE_SIZE } from './cropper-constants.js';
import type { Direction, ImageSize, Rectangle } from './types';

type SvgAttributes = Record<string, string | number>;
type SideDirection = 'n' | 's' | 'e' | 'w';

type ResizeOptions = {
  rect: Rectangle;
  delta: [number, number];
  aspectRatio?: number;
  imageBox: Rectangle;
};

type MoveRectOptions = {
  rect: Rectangle;
  delta: [number, number];
  imageBox: Rectangle;
};

type PathResult = {
  d: string;
  center: [number, number];
};

export function setSvgNodeAttrs(node: SVGElement, attrs: SvgAttributes): void {
  for (const [name, value] of Object.entries(attrs)) {
    node.setAttributeNS(null, name, value.toString());
  }
}

export function createSvgNode(name: string, attrs: SvgAttributes = {}): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  setSvgNodeAttrs(node, attrs);
  return node;
}

export function cornerPath(rect: Rectangle, direction: Direction, sizeMultiplier: number): PathResult {
  const { x, y, width, height } = rect;

  const wMul: 0 | 1 = direction.includes('w') ? 0 : 1;
  const hMul: 0 | 1 = direction.includes('n') ? 0 : 1;
  const xSide = wMul === 0 ? -1 : 1;
  const ySide = hMul === 0 ? -1 : 1;

  const p1: [number, number] = [
    x + wMul * width + THUMB_OFFSET * xSide,
    y + hMul * height + THUMB_OFFSET * ySide - THUMB_CORNER_SIZE * sizeMultiplier * ySide,
  ];
  const p2: [number, number] = [x + wMul * width + THUMB_OFFSET * xSide, y + hMul * height + THUMB_OFFSET * ySide];
  const p3: [number, number] = [
    x + wMul * width - THUMB_CORNER_SIZE * sizeMultiplier * xSide + THUMB_OFFSET * xSide,
    y + hMul * height + THUMB_OFFSET * ySide,
  ];

  const path = `M ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]}`;
  const center: [number, number] = [p2[0], p2[1]];

  return {
    d: path,
    center,
  };
}

export function sidePath(rect: Rectangle, direction: SideDirection, sizeMultiplier: number): PathResult {
  const { x, y, width, height } = rect;

  const isHorizontal = direction === 'n' || direction === 's';
  const isVertical = direction === 'w' || direction === 'e';

  const wMul = isHorizontal ? 0.5 : direction === 'w' ? 0 : 1;
  const hMul = isVertical ? 0.5 : direction === 'n' ? 0 : 1;
  const xSide = direction === 'w' ? -1 : direction === 'e' ? 1 : 0;
  const ySide = direction === 'n' ? -1 : direction === 's' ? 1 : 0;

  let p1: [number, number];
  let p2: [number, number];
  if (isHorizontal) {
    p1 = [x + wMul * width - (THUMB_SIDE_SIZE * sizeMultiplier) / 2, y + hMul * height + THUMB_OFFSET * ySide];
    p2 = [x + wMul * width + (THUMB_SIDE_SIZE * sizeMultiplier) / 2, y + hMul * height + THUMB_OFFSET * ySide];
  } else {
    p1 = [x + wMul * width + THUMB_OFFSET * xSide, y + hMul * height - (THUMB_SIDE_SIZE * sizeMultiplier) / 2];
    p2 = [x + wMul * width + THUMB_OFFSET * xSide, y + hMul * height + (THUMB_SIDE_SIZE * sizeMultiplier) / 2];
  }
  const path = `M ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]}`;
  const center: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

  return { d: path, center };
}

export function thumbCursor(direction: Direction): string {
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

export function moveRect({ rect, delta: [dx, dy], imageBox }: MoveRectOptions): Rectangle {
  return constraintRect(
    {
      ...rect,
      x: rect.x + dx,
      y: rect.y + dy,
    },
    imageBox,
  );
}

export function constraintRect(rect1: Rectangle, rect2: Rectangle): Rectangle {
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

function resizeNorth({ rect, delta, aspectRatio, imageBox }: ResizeOptions): Rectangle {
  const [, dy] = delta;
  let { y, width, height } = rect;

  y += dy;
  height -= dy;
  if (aspectRatio) {
    width = height * aspectRatio;
  }
  let x = rect.x + rect.width / 2 - width / 2;
  if (y <= imageBox.y) {
    y = imageBox.y;
    height = rect.y + rect.height - y;
    if (aspectRatio) {
      width = height * aspectRatio;
      x = rect.x + rect.width / 2 - width / 2;
    }
  }
  if (x <= imageBox.x) {
    x = imageBox.x;
    y = rect.y + rect.height - height;
  }
  if (x + width >= imageBox.x + imageBox.width) {
    x = Math.max(imageBox.x, imageBox.x + imageBox.width - width);
    width = imageBox.x + imageBox.width - x;
    if (aspectRatio) {
      height = width / aspectRatio;
    }
    y = rect.y + rect.height - height;
  }
  if (height < MIN_CROP_SIZE) {
    height = MIN_CROP_SIZE;
    if (aspectRatio) {
      width = height * aspectRatio;
      x = rect.x + rect.width / 2 - width / 2;
    }
    y = rect.y + rect.height - height;
  }
  if (width < MIN_CROP_SIZE) {
    width = MIN_CROP_SIZE;
    if (aspectRatio) {
      height = width / aspectRatio;
      x = rect.x + rect.width / 2 - width / 2;
    }
    y = rect.y + rect.height - height;
  }

  return { x, y, width, height };
}

function resizeWest({ rect, delta, aspectRatio, imageBox }: ResizeOptions): Rectangle {
  const [dx] = delta;
  let { x, width, height } = rect;

  x += dx;
  width -= dx;
  if (aspectRatio) {
    height = width / aspectRatio;
  }
  let y = rect.y + rect.height / 2 - height / 2;
  if (x <= imageBox.x) {
    x = imageBox.x;
    width = rect.x + rect.width - x;
    if (aspectRatio) {
      height = width / aspectRatio;
      y = rect.y + rect.height / 2 - height / 2;
    }
  }
  if (y <= imageBox.y) {
    y = imageBox.y;
    x = rect.x + rect.width - width;
  }
  if (y + height >= imageBox.y + imageBox.height) {
    y = Math.max(imageBox.y, imageBox.y + imageBox.height - height);
    height = imageBox.y + imageBox.height - y;
    if (aspectRatio) {
      width = height * aspectRatio;
    }
    x = rect.x + rect.width - width;
  }
  if (height < MIN_CROP_SIZE) {
    height = MIN_CROP_SIZE;
    if (aspectRatio) {
      width = height * aspectRatio;
    }
    y = rect.y + rect.height / 2 - height / 2;
    x = rect.x + rect.width - width;
  }
  if (width < MIN_CROP_SIZE) {
    width = MIN_CROP_SIZE;
    if (aspectRatio) {
      height = width / aspectRatio;
    }
    y = rect.y + rect.height / 2 - height / 2;
    x = rect.x + rect.width - width;
  }

  return { x, y, width, height };
}

function resizeSouth({ rect, delta, aspectRatio, imageBox }: ResizeOptions): Rectangle {
  const [, dy] = delta;
  let { y, width, height } = rect;

  height += dy;
  if (aspectRatio) {
    width = height * aspectRatio;
  }
  let x = rect.x + rect.width / 2 - width / 2;
  if (y + height >= imageBox.y + imageBox.height) {
    height = imageBox.y + imageBox.height - y;
    if (aspectRatio) {
      width = height * aspectRatio;
    }
    x = rect.x + rect.width / 2 - width / 2;
  }
  if (x <= imageBox.x) {
    x = imageBox.x;
    y = rect.y;
  }
  if (x + width >= imageBox.x + imageBox.width) {
    x = Math.max(imageBox.x, imageBox.x + imageBox.width - width);
    width = imageBox.x + imageBox.width - x;
    if (aspectRatio) {
      height = width / aspectRatio;
    }
    y = rect.y;
  }
  if (height < MIN_CROP_SIZE) {
    height = MIN_CROP_SIZE;
    if (aspectRatio) {
      width = height * aspectRatio;
    }
    x = rect.x + rect.width / 2 - width / 2;
  }
  if (width < MIN_CROP_SIZE) {
    width = MIN_CROP_SIZE;
    if (aspectRatio) {
      height = width / aspectRatio;
    }
    x = rect.x + rect.width / 2 - width / 2;
  }

  return { x, y, width, height };
}

function resizeEast({ rect, delta, aspectRatio, imageBox }: ResizeOptions): Rectangle {
  const [dx] = delta;
  let { x, width, height } = rect;

  width += dx;
  if (aspectRatio) {
    height = width / aspectRatio;
  }
  let y = rect.y + rect.height / 2 - height / 2;
  if (x + width >= imageBox.x + imageBox.width) {
    width = imageBox.x + imageBox.width - x;
    if (aspectRatio) {
      height = width / aspectRatio;
    }
    y = rect.y + rect.height / 2 - height / 2;
  }
  if (y <= imageBox.y) {
    y = imageBox.y;
    x = rect.x;
  }
  if (y + height >= imageBox.y + imageBox.height) {
    y = Math.max(imageBox.y, imageBox.y + imageBox.height - height);
    height = imageBox.y + imageBox.height - y;
    if (aspectRatio) {
      width = height * aspectRatio;
    }
    x = rect.x;
  }
  if (height < MIN_CROP_SIZE) {
    height = MIN_CROP_SIZE;
    if (aspectRatio) {
      width = height * aspectRatio;
    }
    y = rect.y + rect.height / 2 - height / 2;
  }
  if (width < MIN_CROP_SIZE) {
    width = MIN_CROP_SIZE;
    if (aspectRatio) {
      height = width / aspectRatio;
    }
    y = rect.y + rect.height / 2 - height / 2;
  }

  return { x, y, width, height };
}

function resizeNorthWest({ rect, delta, aspectRatio, imageBox }: ResizeOptions): Rectangle {
  let [dx, dy] = delta;
  let { x, y, width, height } = rect;

  if (x + dx < imageBox.x) {
    dx = imageBox.x - x;
  }
  if (y + dy < imageBox.y) {
    dy = imageBox.y - y;
  }
  x += dx;
  width -= dx;
  y += dy;
  height -= dy;
  if (aspectRatio && Math.abs(width / height) > aspectRatio) {
    dy = width / aspectRatio - height;
    height += dy;
    y -= dy;
    if (y <= imageBox.y) {
      height = height - (imageBox.y - y);
      width = height * aspectRatio;
      x = rect.x + rect.width - width;
      y = imageBox.y;
    }
  } else if (aspectRatio) {
    dx = height * aspectRatio - width;
    width = width + dx;
    x -= dx;
    if (x <= imageBox.x) {
      width = width - (imageBox.x - x);
      height = width / aspectRatio;
      x = imageBox.x;
      y = rect.y + rect.height - height;
    }
  }
  if (height < MIN_CROP_SIZE) {
    height = MIN_CROP_SIZE;
    if (aspectRatio) {
      width = height * aspectRatio;
    }
    x = rect.x + rect.width - width;
    y = rect.y + rect.height - height;
  }
  if (width < MIN_CROP_SIZE) {
    width = MIN_CROP_SIZE;
    if (aspectRatio) {
      height = width / aspectRatio;
    }
    x = rect.x + rect.width - width;
    y = rect.y + rect.height - height;
  }

  return { x, y, width, height };
}

function resizeNorthEast({ rect, delta, aspectRatio, imageBox }: ResizeOptions): Rectangle {
  let [dx, dy] = delta;
  let { x, y, width, height } = rect;

  if (x + width + dx > imageBox.x + imageBox.width) {
    dx = imageBox.x + imageBox.width - x - width;
  }
  if (y + dy < imageBox.y) {
    dy = imageBox.y - y;
  }
  width += dx;
  y += dy;
  height -= dy;
  if (aspectRatio && Math.abs(width / height) > aspectRatio) {
    dy = width / aspectRatio - height;
    height += dy;
    y -= dy;
    if (y <= imageBox.y) {
      height = height - (imageBox.y - y);
      width = height * aspectRatio;
      x = rect.x;
      y = imageBox.y;
    }
  } else if (aspectRatio) {
    dx = height * aspectRatio - width;
    width += dx;
    if (x + width >= imageBox.x + imageBox.width) {
      width = imageBox.x + imageBox.width - x;
      height = width / aspectRatio;
      x = imageBox.x + imageBox.width - width;
      y = rect.y + rect.height - height;
    }
  }
  if (height < MIN_CROP_SIZE) {
    height = MIN_CROP_SIZE;
    if (aspectRatio) {
      width = height * aspectRatio;
    }
    y = rect.y + rect.height - height;
  }
  if (width < MIN_CROP_SIZE) {
    width = MIN_CROP_SIZE;
    if (aspectRatio) {
      height = width / aspectRatio;
    }
    y = rect.y + rect.height - height;
  }

  return { x, y, width, height };
}

function resizeSouthWest({ rect, delta, aspectRatio, imageBox }: ResizeOptions): Rectangle {
  let [dx, dy] = delta;
  let { x, y, width, height } = rect;

  if (x + dx < imageBox.x) {
    dx = imageBox.x - x;
  }
  if (y + height + dy > imageBox.y + imageBox.height) {
    dy = imageBox.y + imageBox.height - y - height;
  }
  x += dx;
  width -= dx;
  height += dy;
  if (aspectRatio && Math.abs(width / height) > aspectRatio) {
    dy = width / aspectRatio - height;
    height += dy;
    if (y + height >= imageBox.y + imageBox.height) {
      height = imageBox.y + imageBox.height - y;
      width = height * aspectRatio;
      x = rect.x + rect.width - width;
      y = imageBox.y + imageBox.height - height;
    }
  } else if (aspectRatio) {
    dx = height * aspectRatio - width;
    width += dx;
    x -= dx;
    if (x <= imageBox.x) {
      width = width - (imageBox.x - x);
      height = width / aspectRatio;
      x = imageBox.x;
      y = rect.y;
    }
  }
  if (height < MIN_CROP_SIZE) {
    height = MIN_CROP_SIZE;
    if (aspectRatio) {
      width = height * aspectRatio;
    }
    x = rect.x + rect.width - width;
  }
  if (width < MIN_CROP_SIZE) {
    width = MIN_CROP_SIZE;
    if (aspectRatio) {
      height = width / aspectRatio;
    }
    x = rect.x + rect.width - width;
  }

  return { x, y, width, height };
}

function resizeSouthEast({ rect, delta, aspectRatio, imageBox }: ResizeOptions): Rectangle {
  let [dx, dy] = delta;
  let { x, y, width, height } = rect;

  if (x + width + dx > imageBox.x + imageBox.width) {
    dx = imageBox.x + imageBox.width - x - width;
  }
  if (y + height + dy > imageBox.y + imageBox.height) {
    dy = imageBox.y + imageBox.height - y - height;
  }
  width += dx;
  height += dy;
  if (aspectRatio && Math.abs(width / height) > aspectRatio) {
    dy = width / aspectRatio - height;
    height += dy;
    if (y + height >= imageBox.y + imageBox.height) {
      height = imageBox.y + imageBox.height - y;
      width = height * aspectRatio;
      x = rect.x;
      y = imageBox.y + imageBox.height - height;
    }
  } else if (aspectRatio) {
    dx = height * aspectRatio - width;
    width += dx;
    if (x + width >= imageBox.x + imageBox.width) {
      width = imageBox.x + imageBox.width - x;
      height = width / aspectRatio;
      x = imageBox.x + imageBox.width - width;
      y = rect.y;
    }
  }
  if (height < MIN_CROP_SIZE) {
    height = MIN_CROP_SIZE;
    if (aspectRatio) {
      width = height * aspectRatio;
    }
  }
  if (width < MIN_CROP_SIZE) {
    width = MIN_CROP_SIZE;
    if (aspectRatio) {
      height = width / aspectRatio;
    }
  }

  return { x, y, width, height };
}

export function resizeRect({ direction, ...rest }: ResizeOptions & { direction: Direction }): Rectangle {
  switch (direction) {
    case 'n':
      return resizeNorth(rest);
    case 'w':
      return resizeWest(rest);
    case 's':
      return resizeSouth(rest);
    case 'e':
      return resizeEast(rest);
    case 'nw':
      return resizeNorthWest(rest);
    case 'ne':
      return resizeNorthEast(rest);
    case 'sw':
      return resizeSouthWest(rest);
    case 'se':
      return resizeSouthEast(rest);
    default:
      return rest.rect;
  }
}

export function rectContainsPoint(rect: Rectangle, [x, y]: [number, number]): boolean {
  return rect.x <= x && x <= rect.x + rect.width && rect.y <= y && y <= rect.y + rect.height;
}

export function isRectInsideRect(rect1: Rectangle, rect2: Rectangle): boolean {
  return (
    rect1.x >= rect2.x &&
    rect1.y >= rect2.y &&
    rect1.x + rect1.width <= rect2.x + rect2.width &&
    rect1.y + rect1.height <= rect2.y + rect2.height
  );
}

export function isRectMatchesAspectRatio(rect: Rectangle, aspectRatio: number): boolean {
  const THRESHOLD = 0.1;
  return Math.abs(rect.width / rect.height - aspectRatio) < THRESHOLD;
}

export function rotateSize({ width, height }: ImageSize, angle: number): ImageSize {
  const swap = (angle / 90) % 2 !== 0;
  return { width: swap ? height : width, height: swap ? width : height };
}

export function calculateMaxCenteredCropFrame(width: number, height: number, aspectRatio: number): Rectangle {
  const imageAspectRatio = width / height;
  let cropWidth: number;
  let cropHeight: number;

  if (imageAspectRatio > aspectRatio) {
    cropWidth = Math.round(height * aspectRatio);
    cropHeight = height;
  } else {
    cropWidth = width;
    cropHeight = Math.round(width / aspectRatio);
  }

  const cropX = Math.round((width - cropWidth) / 2);
  const cropY = Math.round((height - cropHeight) / 2);

  if (cropX + cropWidth > width) {
    cropWidth = width - cropX;
  }
  if (cropY + cropHeight > height) {
    cropHeight = height - cropY;
  }

  return { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
}

export function roundRect(rect: Rectangle): Rectangle {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
