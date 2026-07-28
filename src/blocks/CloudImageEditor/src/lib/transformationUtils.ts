import {
  brightness,
  contrast,
  crop,
  enhance,
  exposure,
  FILTER_NAMES,
  type FilterName,
  filter,
  flip,
  format,
  gamma,
  mirror,
  progressive,
  rotate,
  saturation,
  vibrance,
  warmth,
} from '@uploadcare/cdn-url/ops';
import { logger } from '../../../../abstract/logger';
import { type CdnOperation, serializeOperations } from '../../../../utils/cdn';
import { stringToArray } from '../../../../utils/stringToArray.js';
import type { Transformations } from '../types';

const log = logger.scope('transformation-utils');

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

/**
 * One typed operation creator per transformation. Using the library's creators
 * instead of hand-formatting strings means the CDN's own grammar decides how a
 * value is written — `crop` takes an `Alignment` object rather than a
 * `"x,y"` string we assemble, `progressive` knows it serialises to `yes`.
 * Verified byte-identical to the previous hand-built output.
 */
const OPERATION_WRITERS = {
  enhance: (value: number) => enhance(value),
  brightness: (value: number) => brightness(value),
  exposure: (value: number) => exposure(value),
  gamma: (value: number) => gamma(value),
  contrast: (value: number) => contrast(value),
  saturation: (value: number) => saturation(value),
  vibrance: (value: number) => vibrance(value),
  warmth: (value: number) => warmth(value),
  filter: ({ name, amount }: NonNullable<Transformations['filter']>) => filter(name, amount),
  mirror: () => mirror(),
  flip: () => flip(),
  rotate: (value: number) => rotate(value),
  crop: ({ dimensions, coords }: NonNullable<Transformations['crop']>) =>
    crop(dimensions[0], dimensions[1], { x: coords[0], y: coords[1] }),
} satisfies { [K in (typeof SUPPORTED_OPERATIONS_ORDERED)[number]]: (value: never) => CdnOperation };

/** Whether a value carries information, i.e. differs from the operation's default. */
function isMeaningful<T extends keyof Transformations>(operation: T, value: Transformations[T]): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (operation === 'filter') {
    // A filter at its default amount contributes nothing.
    return (value as NonNullable<Transformations['filter']>).amount !== OPERATIONS_DEFAULTS.filter;
  }
  if (operation === 'crop') {
    return true;
  }
  return OPERATIONS_DEFAULTS[operation] !== value;
}

/**
 * Serialise transformations into a `-/…/` operations string, in the editor's
 * fixed order. Values equal to their default are omitted — a deliberate
 * "don't bloat the URL" policy, and the reason an explicit `brightness/0` does
 * not survive a round-trip.
 */
export function transformationsToOperations(transformations: Transformations): string {
  const operations: CdnOperation[] = [];
  for (const operation of SUPPORTED_OPERATIONS_ORDERED) {
    const value = transformations[operation];
    if (!isMeaningful(operation, value)) {
      continue;
    }
    const write = OPERATION_WRITERS[operation] as (value: Transformations[typeof operation]) => CdnOperation;
    try {
      operations.push(write(value));
    } catch (err) {
      // The typed creators validate (ranges, shapes), which the old string
      // formatting did not — a value the CDN would reject is dropped with a
      // warning rather than written into a URL.
      log.warn(`Skipping unserialisable "${operation}" transformation.`, err);
    }
  }

  return serializeOperations(operations);
}

/** Applied to every editor-generated URL. */
export const COMMON_OPERATIONS = serializeOperations([format('auto'), progressive(true)]);

const asNumber = ([value]: [unknown]) => (typeof value !== 'undefined' ? Number(value) : undefined);
const asBoolean = () => true;
const isFilterName = (value: string): value is FilterName => (FILTER_NAMES as readonly string[]).includes(value);

/**
 * A filter name comes off a URL, so it is untrusted: validate it against the
 * CDN's own list rather than typing it as a `FilterName` we haven't checked.
 * An unrecognised name is rejected the same way unsupported crop syntax is —
 * the caller logs and skips the operation.
 */
const asFilter = ([name, amount]: [string, unknown]) => {
  if (!isFilterName(name)) {
    throw new Error(`Unknown filter "${name}".`);
  }
  return {
    name,
    amount: typeof amount !== 'undefined' ? Number(amount) : 100,
  };
};

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
      log.warn(
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
