import type { FilterName } from '@uploadcare/cdn-url/ops';
/**
 * Mapping of loading resources per operation
 */
export type LoadingOperations = Map<string, Map<string, boolean>>;

/**
 * Image size
 */
export interface ImageSize {
  width: number;
  height: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transformations {
  enhance?: number;
  brightness?: number;
  exposure?: number;
  gamma?: number;
  contrast?: number;
  saturation?: number;
  vibrance?: number;
  warmth?: number;
  rotate?: number;
  mirror?: boolean;
  flip?: boolean;
  filter?: { name: FilterName; amount: number };
  crop?: { dimensions: [number, number]; coords: [number, number] };
}

export interface ApplyResult {
  originalUrl: string;
  cdnUrlModifiers: string;
  cdnUrl: string;
  transformations: Transformations;
}

export type ChangeResult = ApplyResult;

export type { CropAspectRatio, CropPresetList } from '../../../utils/crop/cropPreset';

export type Direction = '' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type FrameThumbs = Partial<
  Record<
    Direction,
    {
      direction: Direction;
      pathNode: SVGElement;
      interactionNode: SVGElement;
      groupNode: SVGElement;
    }
  >
>;
