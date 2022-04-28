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
 * @typedef {Object} Transformations
 * @property {number} [enhance]
 * @property {number} [brightness]
 * @property {number} [exposure]
 * @property {number} [gamma]
 * @property {number} [contrast]
 * @property {number} [saturation]
 * @property {number} [vibrance]
 * @property {number} [warmth]
 * @property {number} [rotate]
 * @property {boolean} [mirror]
 * @property {boolean} [flip]
 * @property {{ name: string; amount: number }} [filter]
 * @property {{ dimensions: [number, number]; coords: [number, number] }} [crop]
 */

/**
 * @typedef {Object} ApplyResult
 * @property {string} originalUrl
 * @property {string} cdnUrlModifiers
 * @property {string} cdnUrl
 * @property {Transformations} transformations
 */

export {};
