/**
 * Mapping of loading resources per operation
 *
 * @typedef {Map<String, Map<String, boolean>>} LoadingOperations
 */

/**
 * Image size
 *
 * @typedef {{ width: Number; height: Number }} ImageSize
 */

/**
 * @typedef {Object} Rectangle
 * @property {Number} x
 * @property {Number} y
 * @property {Number} width
 * @property {Number} height
 */

/**
 * @typedef {{
 *   enhance?: number;
 *   brightness?: number;
 *   exposure?: number;
 *   gamma?: number;
 *   contrast?: number;
 *   saturation?: number;
 *   vibrance?: number;
 *   warmth?: number;
 *   rotate?: number;
 *   mirror?: boolean;
 *   flip?: boolean;
 *   filter?: { name: string; amount: number };
 *   crop?: { dimensions: [number, number]; coords: [number, number] };
 * }} Transformations
 */

/**
 * @typedef {Object} ApplyResult
 * @property {string} originalUrl
 * @property {string} cdnUrlModifiers
 * @property {string} cdnUrl
 * @property {Transformations} transformations
 */

/**
 * @typedef {Object} ChangeResult
 * @property {string} originalUrl
 * @property {string} cdnUrlModifiers
 * @property {string} cdnUrl
 * @property {Transformations} transformations
 */

/** @typedef {{ type: 'aspect-ratio'; width: number; height: number }} CropAspectRatio */

/** @typedef {CropAspectRatio[]} CropPresetList */

/**
 * @typedef {Partial<{
 *   [K in Direction]: {
 *     direction: Direction;
 *     pathNode: SVGElement;
 *     interactionNode: SVGElement;
 *     groupNode: SVGElement;
 *   };
 * }>} FrameThumbs
 */

/** @typedef {'' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'} Direction */

export {};
