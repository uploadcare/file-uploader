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
function operationToStr(operation, options) {
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

/**
 * @param {String[]} list
 * @returns {String}
 */
export function joinCdnOperations(...list) {
  return list.join('/-/').replace(/\/\//g, '/');
}

const ORDER = [
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
 * @param {any} transformations
 * @returns {String}
 */
export function transformationsToString(transformations) {
  return joinCdnOperations(
    ...ORDER.filter(
      (operation) => typeof transformations[operation] !== 'undefined' && transformations[operation] !== null
    )
      .map((operation) => {
        let options = transformations[operation];
        return operationToStr(operation, options);
      })
      .filter((str) => str && str.length > 0)
  );
}

/**
 * @param {String} originalUrl
 * @param {String[]} list
 * @returns {String}
 */
export function constructCdnUrl(originalUrl, ...list) {
  return (
    originalUrl.replace(/\/$/g, '') + '/-/' + joinCdnOperations(...list.filter((str) => str && str.length > 0)) + '/'
  );
}

export const COMMON_OPERATIONS = ['format/auto', 'progressive/yes'].join('/-/');
