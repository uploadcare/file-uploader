import { joinCdnOperations } from '../../../../utils/cdn-utils.js';

export const OPERATIONS_ZEROS = {
  brightness: 0,
  exposure: 0,
  gamma: 100,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  warmth: 0,
  enhance: 0,
  filter: 0,
  rotate: 0,
};

/**
 * @param {String} operation
 * @param {Number | String | object} options
 * @returns {String}
 */
function transformationToStr(operation, options) {
  if (typeof options === 'number') {
    return OPERATIONS_ZEROS[operation] !== options ? `${operation}/${options}` : '';
  }

  if (typeof options === 'boolean') {
    return options && OPERATIONS_ZEROS[operation] !== options ? `${operation}` : '';
  }

  if (operation === 'filter') {
    if (!options || OPERATIONS_ZEROS[operation] === options.amount) {
      return '';
    }
    let { name, amount } = options;
    return `${operation}/${name}/${amount}`;
  }

  if (operation === 'crop') {
    if (!options) {
      return '';
    }
    let { dimensions, coords } = options;
    return `${operation}/${dimensions.join('x')}/${coords.join(',')}`;
  }

  return '';
}

// TODO: refactor all the operations constants
const SUPPORTED_OPERATIONS_ORDERED = [
  'enhance',
  'brightness',
  'exposure',
  'gamma',
  'contrast',
  'saturation',
  'vibrance',
  'warmth',
  'filter',
  'mirror',
  'flip',
  'rotate',
  'crop',
];

/**
 * @param {import('../types').Transformations} transformations
 * @returns {String}
 */
export function transformationsToOperations(transformations) {
  return joinCdnOperations(
    ...SUPPORTED_OPERATIONS_ORDERED.filter(
      (operation) => typeof transformations[operation] !== 'undefined' && transformations[operation] !== null
    )
      .map((operation) => {
        let options = transformations[operation];
        return transformationToStr(operation, options);
      })
      .filter((str) => !!str)
  );
}

export const COMMON_OPERATIONS = joinCdnOperations('format/auto', 'progressive/yes');

const asNumber = ([value]) => (typeof value !== 'undefined' ? Number(value) : undefined);
const asBoolean = () => true;
const asFilter = ([name, amount]) => ({
  name,
  amount: typeof amount !== 'undefined' ? Number(amount) : 100,
});

// Docs: https://uploadcare.com/docs/transformations/image/resize-crop/#operation-crop
// We don't support percentages and aligment presets,
// Because it's unclear how to handle them in the Editor UI
// TODO: add support for percentages and aligment presets
const asCrop = ([dimensions, coords]) => {
  return { dimensions: dimensions.split('x').map(Number), coords: coords.split(',').map(Number) };
};

const OPERATION_PROCESSORS = {
  enhance: asNumber,
  brightness: asNumber,
  exposure: asNumber,
  gamma: asNumber,
  contrast: asNumber,
  saturation: asNumber,
  vibrance: asNumber,
  warmth: asNumber,
  filter: asFilter,
  mirror: asBoolean,
  flip: asBoolean,
  rotate: asNumber,
  crop: asCrop,
};

/**
 * @param {string[]} operations
 * @returns {import('../types.js').Transformations}
 */
export function operationsToTransformations(operations) {
  /** @type {import('../types.js').Transformations} */
  let transformations = {};
  for (let operation of operations) {
    let [name, ...args] = operation.split('/');
    if (!SUPPORTED_OPERATIONS_ORDERED.includes(name)) {
      continue;
    }
    const processor = OPERATION_PROCESSORS[name];
    const value = processor(args);
    transformations[name] = value;
  }
  return transformations;
}
