import { describe, expect, it } from 'vitest';
import {
  calculateMaxCenteredCropFrame,
  clamp,
  constraintRect,
  cornerPath,
  createSvgNode,
  isRectInsideRect,
  isRectMatchesAspectRatio,
  moveRect,
  rectContainsPoint,
  resizeRect,
  rotateSize,
  roundRect,
  setSvgNodeAttrs,
  sidePath,
  thumbCursor,
} from './crop-utils';
import type { Rectangle } from './types';

describe('crop-utils', () => {
  describe('setSvgNodeAttrs', () => {
    it('should set string attributes on SVG node', () => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      setSvgNodeAttrs(node, { fill: 'red', stroke: 'blue' });

      expect(node.getAttribute('fill')).toBe('red');
      expect(node.getAttribute('stroke')).toBe('blue');
    });

    it('should set numeric attributes as strings on SVG node', () => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      setSvgNodeAttrs(node, { width: 100, height: 200, x: 10, y: 20 });

      expect(node.getAttribute('width')).toBe('100');
      expect(node.getAttribute('height')).toBe('200');
      expect(node.getAttribute('x')).toBe('10');
      expect(node.getAttribute('y')).toBe('20');
    });
  });

  describe('createSvgNode', () => {
    it('should create an SVG element with given name', () => {
      const node = createSvgNode('rect');

      expect(node.tagName).toBe('rect');
      expect(node.namespaceURI).toBe('http://www.w3.org/2000/svg');
    });

    it('should create an SVG element with attributes', () => {
      const node = createSvgNode('circle', { cx: 50, cy: 50, r: 25, fill: 'green' });

      expect(node.tagName).toBe('circle');
      expect(node.getAttribute('cx')).toBe('50');
      expect(node.getAttribute('cy')).toBe('50');
      expect(node.getAttribute('r')).toBe('25');
      expect(node.getAttribute('fill')).toBe('green');
    });

    it('should create an SVG element without attributes when none provided', () => {
      const node = createSvgNode('path');

      expect(node.tagName).toBe('path');
      expect(node.attributes.length).toBe(0);
    });
  });

  describe('cornerPath', () => {
    const rect: Rectangle = { x: 100, y: 100, width: 200, height: 150 };

    it('should generate path for northwest corner', () => {
      const result = cornerPath(rect, 'nw', 1);

      expect(result.d).toContain('M');
      expect(result.d).toContain('L');
      expect(result.center).toHaveLength(2);
    });

    it('should generate path for northeast corner', () => {
      const result = cornerPath(rect, 'ne', 1);

      expect(result.d).toContain('M');
      expect(result.d).toContain('L');
      expect(result.center).toHaveLength(2);
    });

    it('should generate path for southwest corner', () => {
      const result = cornerPath(rect, 'sw', 1);

      expect(result.d).toContain('M');
      expect(result.d).toContain('L');
      expect(result.center).toHaveLength(2);
    });

    it('should generate path for southeast corner', () => {
      const result = cornerPath(rect, 'se', 1);

      expect(result.d).toContain('M');
      expect(result.d).toContain('L');
      expect(result.center).toHaveLength(2);
    });

    it('should scale path with size multiplier', () => {
      const result1 = cornerPath(rect, 'nw', 1);
      const result2 = cornerPath(rect, 'nw', 2);

      expect(result1.d).not.toBe(result2.d);
    });
  });

  describe('sidePath', () => {
    const rect: Rectangle = { x: 100, y: 100, width: 200, height: 150 };

    it('should generate path for north side', () => {
      const result = sidePath(rect, 'n', 1);

      expect(result.d).toContain('M');
      expect(result.d).toContain('L');
      expect(result.center).toHaveLength(2);
    });

    it('should generate path for south side', () => {
      const result = sidePath(rect, 's', 1);

      expect(result.d).toContain('M');
      expect(result.d).toContain('L');
      expect(result.center).toHaveLength(2);
    });

    it('should generate path for east side', () => {
      const result = sidePath(rect, 'e', 1);

      expect(result.d).toContain('M');
      expect(result.d).toContain('L');
      expect(result.center).toHaveLength(2);
    });

    it('should generate path for west side', () => {
      const result = sidePath(rect, 'w', 1);

      expect(result.d).toContain('M');
      expect(result.d).toContain('L');
      expect(result.center).toHaveLength(2);
    });

    it('should scale path with size multiplier', () => {
      const result1 = sidePath(rect, 'n', 1);
      const result2 = sidePath(rect, 'n', 2);

      expect(result1.d).not.toBe(result2.d);
    });
  });

  describe('thumbCursor', () => {
    it('should return move cursor for empty direction', () => {
      expect(thumbCursor('')).toBe('move');
    });

    it('should return ew-resize for east direction', () => {
      expect(thumbCursor('e')).toBe('ew-resize');
    });

    it('should return ew-resize for west direction', () => {
      expect(thumbCursor('w')).toBe('ew-resize');
    });

    it('should return ns-resize for north direction', () => {
      expect(thumbCursor('n')).toBe('ns-resize');
    });

    it('should return ns-resize for south direction', () => {
      expect(thumbCursor('s')).toBe('ns-resize');
    });

    it('should return nwse-resize for northwest direction', () => {
      expect(thumbCursor('nw')).toBe('nwse-resize');
    });

    it('should return nwse-resize for southeast direction', () => {
      expect(thumbCursor('se')).toBe('nwse-resize');
    });

    it('should return nesw-resize for northeast direction', () => {
      expect(thumbCursor('ne')).toBe('nesw-resize');
    });

    it('should return nesw-resize for southwest direction', () => {
      expect(thumbCursor('sw')).toBe('nesw-resize');
    });
  });

  describe('moveRect', () => {
    const imageBox: Rectangle = { x: 0, y: 0, width: 500, height: 400 };

    it('should move rectangle by delta', () => {
      const rect: Rectangle = { x: 100, y: 100, width: 100, height: 100 };
      const result = moveRect({ rect, delta: [50, 30], imageBox });

      expect(result.x).toBe(150);
      expect(result.y).toBe(130);
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
    });

    it('should constrain rectangle to image box when moving left', () => {
      const rect: Rectangle = { x: 10, y: 100, width: 100, height: 100 };
      const result = moveRect({ rect, delta: [-50, 0], imageBox });

      expect(result.x).toBe(0);
    });

    it('should constrain rectangle to image box when moving up', () => {
      const rect: Rectangle = { x: 100, y: 10, width: 100, height: 100 };
      const result = moveRect({ rect, delta: [0, -50], imageBox });

      expect(result.y).toBe(0);
    });

    it('should constrain rectangle to image box when moving right', () => {
      const rect: Rectangle = { x: 350, y: 100, width: 100, height: 100 };
      const result = moveRect({ rect, delta: [100, 0], imageBox });

      expect(result.x).toBe(400);
    });

    it('should constrain rectangle to image box when moving down', () => {
      const rect: Rectangle = { x: 100, y: 250, width: 100, height: 100 };
      const result = moveRect({ rect, delta: [0, 100], imageBox });

      expect(result.y).toBe(300);
    });
  });

  describe('constraintRect', () => {
    const imageBox: Rectangle = { x: 0, y: 0, width: 500, height: 400 };

    it('should not modify rectangle that is inside bounds', () => {
      const rect: Rectangle = { x: 100, y: 100, width: 100, height: 100 };
      const result = constraintRect(rect, imageBox);

      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('should constrain rectangle that exceeds left bound', () => {
      const rect: Rectangle = { x: -50, y: 100, width: 100, height: 100 };
      const result = constraintRect(rect, imageBox);

      expect(result.x).toBe(0);
    });

    it('should constrain rectangle that exceeds top bound', () => {
      const rect: Rectangle = { x: 100, y: -50, width: 100, height: 100 };
      const result = constraintRect(rect, imageBox);

      expect(result.y).toBe(0);
    });

    it('should constrain rectangle that exceeds right bound', () => {
      const rect: Rectangle = { x: 450, y: 100, width: 100, height: 100 };
      const result = constraintRect(rect, imageBox);

      expect(result.x).toBe(400);
    });

    it('should constrain rectangle that exceeds bottom bound', () => {
      const rect: Rectangle = { x: 100, y: 350, width: 100, height: 100 };
      const result = constraintRect(rect, imageBox);

      expect(result.y).toBe(300);
    });
  });

  describe('resizeRect', () => {
    const imageBox: Rectangle = { x: 0, y: 0, width: 500, height: 400 };
    const rect: Rectangle = { x: 100, y: 100, width: 200, height: 150 };

    describe('without aspect ratio', () => {
      it('should resize north', () => {
        const result = resizeRect({ direction: 'n', rect, delta: [0, -50], imageBox });

        expect(result.height).toBeGreaterThan(rect.height);
        expect(result.y).toBeLessThan(rect.y);
      });

      it('should resize south', () => {
        const result = resizeRect({ direction: 's', rect, delta: [0, 50], imageBox });

        expect(result.height).toBeGreaterThan(rect.height);
        expect(result.y).toBe(rect.y);
      });

      it('should resize east', () => {
        const result = resizeRect({ direction: 'e', rect, delta: [50, 0], imageBox });

        expect(result.width).toBeGreaterThan(rect.width);
        expect(result.x).toBe(rect.x);
      });

      it('should resize west', () => {
        const result = resizeRect({ direction: 'w', rect, delta: [-50, 0], imageBox });

        expect(result.width).toBeGreaterThan(rect.width);
        expect(result.x).toBeLessThan(rect.x);
      });

      it('should resize northwest', () => {
        const result = resizeRect({ direction: 'nw', rect, delta: [-50, -50], imageBox });

        expect(result.width).toBeGreaterThan(rect.width);
        expect(result.height).toBeGreaterThan(rect.height);
        expect(result.x).toBeLessThan(rect.x);
        expect(result.y).toBeLessThan(rect.y);
      });

      it('should resize northeast', () => {
        const result = resizeRect({ direction: 'ne', rect, delta: [50, -50], imageBox });

        expect(result.width).toBeGreaterThan(rect.width);
        expect(result.height).toBeGreaterThan(rect.height);
        expect(result.y).toBeLessThan(rect.y);
      });

      it('should resize southwest', () => {
        const result = resizeRect({ direction: 'sw', rect, delta: [-50, 50], imageBox });

        expect(result.width).toBeGreaterThan(rect.width);
        expect(result.height).toBeGreaterThan(rect.height);
        expect(result.x).toBeLessThan(rect.x);
      });

      it('should resize southeast', () => {
        const result = resizeRect({ direction: 'se', rect, delta: [50, 50], imageBox });

        expect(result.width).toBeGreaterThan(rect.width);
        expect(result.height).toBeGreaterThan(rect.height);
      });

      it('should return original rect for empty direction', () => {
        const result = resizeRect({ direction: '', rect, delta: [50, 50], imageBox });

        expect(result).toEqual(rect);
      });
    });

    describe('with aspect ratio', () => {
      const aspectRatio = 4 / 3;

      it('should maintain aspect ratio when resizing north', () => {
        const result = resizeRect({ direction: 'n', rect, delta: [0, -60], imageBox, aspectRatio });

        expect(Math.abs(result.width / result.height - aspectRatio)).toBeLessThan(0.01);
      });

      it('should maintain aspect ratio when resizing south', () => {
        const result = resizeRect({ direction: 's', rect, delta: [0, 60], imageBox, aspectRatio });

        expect(Math.abs(result.width / result.height - aspectRatio)).toBeLessThan(0.01);
      });

      it('should maintain aspect ratio when resizing east', () => {
        const result = resizeRect({ direction: 'e', rect, delta: [60, 0], imageBox, aspectRatio });

        expect(Math.abs(result.width / result.height - aspectRatio)).toBeLessThan(0.01);
      });

      it('should maintain aspect ratio when resizing west', () => {
        const result = resizeRect({ direction: 'w', rect, delta: [-60, 0], imageBox, aspectRatio });

        expect(Math.abs(result.width / result.height - aspectRatio)).toBeLessThan(0.01);
      });

      it('should maintain aspect ratio when resizing northwest', () => {
        const result = resizeRect({ direction: 'nw', rect, delta: [-60, -45], imageBox, aspectRatio });

        expect(Math.abs(result.width / result.height - aspectRatio)).toBeLessThan(0.01);
      });

      it('should maintain aspect ratio when resizing northeast', () => {
        const result = resizeRect({ direction: 'ne', rect, delta: [60, -45], imageBox, aspectRatio });

        expect(Math.abs(result.width / result.height - aspectRatio)).toBeLessThan(0.01);
      });

      it('should maintain aspect ratio when resizing southwest', () => {
        const result = resizeRect({ direction: 'sw', rect, delta: [-60, 45], imageBox, aspectRatio });

        expect(Math.abs(result.width / result.height - aspectRatio)).toBeLessThan(0.01);
      });

      it('should maintain aspect ratio when resizing southeast', () => {
        const result = resizeRect({ direction: 'se', rect, delta: [60, 45], imageBox, aspectRatio });

        expect(Math.abs(result.width / result.height - aspectRatio)).toBeLessThan(0.01);
      });
    });

    describe('boundary constraints', () => {
      it('should constrain to top boundary when resizing north', () => {
        const nearTop: Rectangle = { x: 100, y: 20, width: 200, height: 150 };
        const result = resizeRect({ direction: 'n', rect: nearTop, delta: [0, -100], imageBox });

        expect(result.y).toBeGreaterThanOrEqual(0);
      });

      it('should constrain to left boundary when resizing west', () => {
        const nearLeft: Rectangle = { x: 20, y: 100, width: 200, height: 150 };
        const result = resizeRect({ direction: 'w', rect: nearLeft, delta: [-100, 0], imageBox });

        expect(result.x).toBeGreaterThanOrEqual(0);
      });

      it('should constrain to bottom boundary when resizing south', () => {
        const nearBottom: Rectangle = { x: 100, y: 200, width: 200, height: 150 };
        const result = resizeRect({ direction: 's', rect: nearBottom, delta: [0, 200], imageBox });

        expect(result.y + result.height).toBeLessThanOrEqual(imageBox.height);
      });

      it('should constrain to right boundary when resizing east', () => {
        const nearRight: Rectangle = { x: 250, y: 100, width: 200, height: 150 };
        const result = resizeRect({ direction: 'e', rect: nearRight, delta: [200, 0], imageBox });

        expect(result.x + result.width).toBeLessThanOrEqual(imageBox.width);
      });
    });

    describe('minimum size constraints', () => {
      it('should enforce minimum size when shrinking too much', () => {
        const result = resizeRect({ direction: 's', rect, delta: [0, -200], imageBox });

        expect(result.height).toBeGreaterThanOrEqual(1);
      });

      it('should enforce minimum width when shrinking east to west', () => {
        const result = resizeRect({ direction: 'e', rect, delta: [-300, 0], imageBox });

        expect(result.width).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('rectContainsPoint', () => {
    const rect: Rectangle = { x: 100, y: 100, width: 200, height: 150 };

    it('should return true for point inside rectangle', () => {
      expect(rectContainsPoint(rect, [150, 150])).toBe(true);
    });

    it('should return true for point on left edge', () => {
      expect(rectContainsPoint(rect, [100, 150])).toBe(true);
    });

    it('should return true for point on top edge', () => {
      expect(rectContainsPoint(rect, [150, 100])).toBe(true);
    });

    it('should return true for point on right edge', () => {
      expect(rectContainsPoint(rect, [300, 150])).toBe(true);
    });

    it('should return true for point on bottom edge', () => {
      expect(rectContainsPoint(rect, [150, 250])).toBe(true);
    });

    it('should return true for corner points', () => {
      expect(rectContainsPoint(rect, [100, 100])).toBe(true);
      expect(rectContainsPoint(rect, [300, 100])).toBe(true);
      expect(rectContainsPoint(rect, [100, 250])).toBe(true);
      expect(rectContainsPoint(rect, [300, 250])).toBe(true);
    });

    it('should return false for point outside rectangle', () => {
      expect(rectContainsPoint(rect, [50, 150])).toBe(false);
      expect(rectContainsPoint(rect, [350, 150])).toBe(false);
      expect(rectContainsPoint(rect, [150, 50])).toBe(false);
      expect(rectContainsPoint(rect, [150, 300])).toBe(false);
    });
  });

  describe('isRectInsideRect', () => {
    const outerRect: Rectangle = { x: 0, y: 0, width: 500, height: 400 };

    it('should return true when inner rect is completely inside outer rect', () => {
      const innerRect: Rectangle = { x: 100, y: 100, width: 200, height: 150 };

      expect(isRectInsideRect(innerRect, outerRect)).toBe(true);
    });

    it('should return true when inner rect matches outer rect exactly', () => {
      expect(isRectInsideRect(outerRect, outerRect)).toBe(true);
    });

    it('should return true when inner rect touches edges', () => {
      const touchingEdges: Rectangle = { x: 0, y: 0, width: 500, height: 400 };

      expect(isRectInsideRect(touchingEdges, outerRect)).toBe(true);
    });

    it('should return false when inner rect exceeds left bound', () => {
      const exceeds: Rectangle = { x: -10, y: 100, width: 200, height: 150 };

      expect(isRectInsideRect(exceeds, outerRect)).toBe(false);
    });

    it('should return false when inner rect exceeds top bound', () => {
      const exceeds: Rectangle = { x: 100, y: -10, width: 200, height: 150 };

      expect(isRectInsideRect(exceeds, outerRect)).toBe(false);
    });

    it('should return false when inner rect exceeds right bound', () => {
      const exceeds: Rectangle = { x: 350, y: 100, width: 200, height: 150 };

      expect(isRectInsideRect(exceeds, outerRect)).toBe(false);
    });

    it('should return false when inner rect exceeds bottom bound', () => {
      const exceeds: Rectangle = { x: 100, y: 300, width: 200, height: 150 };

      expect(isRectInsideRect(exceeds, outerRect)).toBe(false);
    });
  });

  describe('isRectMatchesAspectRatio', () => {
    it('should return true when aspect ratio matches within threshold', () => {
      const rect: Rectangle = { x: 0, y: 0, width: 400, height: 300 };

      expect(isRectMatchesAspectRatio(rect, 4 / 3)).toBe(true);
    });

    it('should return true for exact 16:9 aspect ratio', () => {
      const rect: Rectangle = { x: 0, y: 0, width: 1920, height: 1080 };

      expect(isRectMatchesAspectRatio(rect, 16 / 9)).toBe(true);
    });

    it('should return true for 1:1 aspect ratio', () => {
      const rect: Rectangle = { x: 0, y: 0, width: 500, height: 500 };

      expect(isRectMatchesAspectRatio(rect, 1)).toBe(true);
    });

    it('should return false when aspect ratio differs significantly', () => {
      const rect: Rectangle = { x: 0, y: 0, width: 400, height: 300 };

      expect(isRectMatchesAspectRatio(rect, 16 / 9)).toBe(false);
    });

    it('should return true for slight variation within threshold', () => {
      const rect: Rectangle = { x: 0, y: 0, width: 401, height: 300 };

      expect(isRectMatchesAspectRatio(rect, 4 / 3)).toBe(true);
    });
  });

  describe('rotateSize', () => {
    it('should not swap dimensions for 0 degree rotation', () => {
      const result = rotateSize({ width: 800, height: 600 }, 0);

      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('should swap dimensions for 90 degree rotation', () => {
      const result = rotateSize({ width: 800, height: 600 }, 90);

      expect(result.width).toBe(600);
      expect(result.height).toBe(800);
    });

    it('should not swap dimensions for 180 degree rotation', () => {
      const result = rotateSize({ width: 800, height: 600 }, 180);

      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('should swap dimensions for 270 degree rotation', () => {
      const result = rotateSize({ width: 800, height: 600 }, 270);

      expect(result.width).toBe(600);
      expect(result.height).toBe(800);
    });

    it('should not swap dimensions for 360 degree rotation', () => {
      const result = rotateSize({ width: 800, height: 600 }, 360);

      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });
  });

  describe('calculateMaxCenteredCropFrame', () => {
    it('should calculate centered crop for wider image than aspect ratio', () => {
      const result = calculateMaxCenteredCropFrame(1600, 900, 4 / 3);

      expect(result.width).toBeLessThanOrEqual(1600);
      expect(result.height).toBe(900);
      expect(result.x).toBeGreaterThan(0);
      expect(result.y).toBe(0);
    });

    it('should calculate centered crop for taller image than aspect ratio', () => {
      const result = calculateMaxCenteredCropFrame(800, 1200, 4 / 3);

      expect(result.width).toBe(800);
      expect(result.height).toBeLessThanOrEqual(1200);
      expect(result.x).toBe(0);
      expect(result.y).toBeGreaterThan(0);
    });

    it('should calculate crop for exact aspect ratio match', () => {
      const result = calculateMaxCenteredCropFrame(800, 600, 4 / 3);

      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should calculate crop for 1:1 aspect ratio', () => {
      const result = calculateMaxCenteredCropFrame(1920, 1080, 1);

      expect(result.width).toBe(1080);
      expect(result.height).toBe(1080);
      expect(result.x).toBe(420);
      expect(result.y).toBe(0);
    });

    it('should calculate crop for 16:9 aspect ratio on 4:3 image', () => {
      const result = calculateMaxCenteredCropFrame(800, 600, 16 / 9);

      expect(result.width).toBe(800);
      expect(result.height).toBeLessThanOrEqual(600);
      expect(Math.abs(result.width / result.height - 16 / 9)).toBeLessThan(0.1);
    });

    it('should not exceed image bounds', () => {
      const result = calculateMaxCenteredCropFrame(100, 100, 2);

      expect(result.x + result.width).toBeLessThanOrEqual(100);
      expect(result.y + result.height).toBeLessThanOrEqual(100);
    });
  });

  describe('roundRect', () => {
    it('should round all rectangle values', () => {
      const rect: Rectangle = { x: 10.4, y: 20.6, width: 100.3, height: 50.7 };
      const result = roundRect(rect);

      expect(result.x).toBe(10);
      expect(result.y).toBe(21);
      expect(result.width).toBe(100);
      expect(result.height).toBe(51);
    });

    it('should handle already rounded values', () => {
      const rect: Rectangle = { x: 10, y: 20, width: 100, height: 50 };
      const result = roundRect(rect);

      expect(result).toEqual(rect);
    });

    it('should round 0.5 up', () => {
      const rect: Rectangle = { x: 10.5, y: 20.5, width: 100.5, height: 50.5 };
      const result = roundRect(rect);

      expect(result.x).toBe(11);
      expect(result.y).toBe(21);
      expect(result.width).toBe(101);
      expect(result.height).toBe(51);
    });

    it('should handle negative values', () => {
      const rect: Rectangle = { x: -10.4, y: -20.6, width: 100.3, height: 50.7 };
      const result = roundRect(rect);

      expect(result.x).toBe(-10);
      expect(result.y).toBe(-21);
      expect(result.width).toBe(100);
      expect(result.height).toBe(51);
    });
  });

  describe('clamp', () => {
    it('should return value when within range', () => {
      expect(clamp(50, 0, 100)).toBe(50);
    });

    it('should return min when value is below range', () => {
      expect(clamp(-10, 0, 100)).toBe(0);
    });

    it('should return max when value is above range', () => {
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it('should return min when value equals min', () => {
      expect(clamp(0, 0, 100)).toBe(0);
    });

    it('should return max when value equals max', () => {
      expect(clamp(100, 0, 100)).toBe(100);
    });

    it('should work with negative ranges', () => {
      expect(clamp(-50, -100, -10)).toBe(-50);
      expect(clamp(-150, -100, -10)).toBe(-100);
      expect(clamp(0, -100, -10)).toBe(-10);
    });

    it('should work with decimal values', () => {
      expect(clamp(0.5, 0, 1)).toBe(0.5);
      expect(clamp(-0.5, 0, 1)).toBe(0);
      expect(clamp(1.5, 0, 1)).toBe(1);
    });
  });
});
