import { joinCdnOperations } from '../../../../utils/cdn-utils.js';
import { stringToArray } from '../../../../utils/stringToArray.js';
import type { Transformations } from '../types';

type OperationDefaults = Readonly<Record<keyof Transformations, unknown>>;

export const OPERATIONS_DEFAULTS: OperationDefaults = Object.freeze({
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
  mirror: false,
  flip: false,
  crop: undefined,
}) satisfies OperationDefaults;

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
] as const satisfies readonly (keyof Transformations)[];

function transformationToStr<T extends keyof Transformations>(operation: T, options: Transformations[T]): string {
  if (typeof options === 'number') {
    const value = options;
    return OPERATIONS_DEFAULTS[operation] !== value ? `${operation}/${value}` : '';
  }

  if (typeof options === 'boolean') {
    const value = options;
    return OPERATIONS_DEFAULTS[operation] !== value ? `${operation}` : '';
  }

  if (operation === 'filter' && options) {
    const { name, amount } = options as NonNullable<Transformations['filter']>;
    if (OPERATIONS_DEFAULTS.filter === amount) {
      return '';
    }
    return `${operation}/${name}/${amount}`;
  }

  if (operation === 'crop' && options) {
    const { dimensions, coords } = options as NonNullable<Transformations['crop']>;
    return `${operation}/${dimensions.join('x')}/${coords.join(',')}`;
  }

  return '';
}

export function transformationsToOperations(transformations: Transformations): string {
  return joinCdnOperations(
    ...SUPPORTED_OPERATIONS_ORDERED.filter(
      (operation) => typeof transformations[operation] !== 'undefined' && transformations[operation] !== null,
    )
      .map((operation) => {
        const options = transformations[operation];
        return transformationToStr(operation, options);
      })
      .filter((str) => !!str),
  );
}

export const COMMON_OPERATIONS = joinCdnOperations('format/auto', 'progressive/yes');

const asNumber = ([value]: [unknown]) => (typeof value !== 'undefined' ? Number(value) : undefined);
const asBoolean = () => true;
const asFilter = ([name, amount]: [string, unknown]) => ({
  name,
  amount: typeof amount !== 'undefined' ? Number(amount) : 100,
});

/**
 * Docs: https://uploadcare.com/docs/transformations/image/resize-crop/#operation-crop We don't support percentages and
 * alignment presets, Because it's unclear how to handle them in the Editor UI TODO: add support for percentages and
 * alignment presets
 *
 */
const asCrop = ([dimensions, alignment]: [string, string]) => {
  if (!/\d+x\d+/.test(dimensions) || !/\d+,\d+/.test(alignment)) {
    throw new Error('Crop by aspect ratio, percentage or alignment shortcuts is not supported.');
  }

  return {
    dimensions: stringToArray(dimensions, 'x').map(Number),
    coords: stringToArray(alignment).map(Number),
  };
};

type ProcessorTuple<K extends keyof Transformations> = K extends 'filter'
  ? [string, unknown]
  : K extends 'crop'
    ? [string, string]
    : [unknown];

type OperationProcessorMap = {
  [K in keyof Transformations]-?: (args: ProcessorTuple<K>) => Transformations[K];
};

const OPERATION_PROCESSORS: OperationProcessorMap = Object.freeze({
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
  crop: (args) => {
    const [dimensions, alignment] = args;
    const { dimensions: parsedDimensions, coords } = asCrop([dimensions, alignment]);
    return {
      dimensions: parsedDimensions as [number, number],
      coords: coords as [number, number],
    };
  },
});

export function operationsToTransformations(operations: string[]): Transformations {
  const transformations: Partial<Record<keyof Transformations, unknown>> = {};
  for (const operation of operations) {
    const [name, ...args] = operation.split('/');
    if (!name || !SUPPORTED_OPERATIONS_ORDERED.includes(name as keyof Transformations)) {
      continue;
    }
    const operationName = name as (typeof SUPPORTED_OPERATIONS_ORDERED)[number];
    const processor = OPERATION_PROCESSORS[operationName] as (
      args: ProcessorTuple<typeof operationName>,
    ) => Transformations[typeof operationName];
    try {
      const value = processor(args as ProcessorTuple<typeof operationName>);
      transformations[operationName] = value;
    } catch (err) {
      console.warn(
        [
          `Failed to parse URL operation "${operation}". It will be ignored.`,
          err instanceof Error ? `Error message: "${err.message}"` : err,
          'If you need this functionality, please feel free to open an issue at https://github.com/uploadcare/blocks/issues/new',
        ].join('\n'),
      );
    }
  }

  return transformations as Transformations;
}
