import { type CdnOperation, modifiers, type OperationLiteral } from '@uploadcare/cdn-url';
import { FILTER_NAMES, type FilterName } from '@uploadcare/cdn-url/ops';
import { logger } from '../../../../abstract/logger';
import { operationsFromModifiers } from '../../../../utils/cdn/operations';
import { deserializeCsv } from '../../../../utils/comma-separated';
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
 * One typed operation literal per transformation. Each writer authors the
 * CDN's own grammar directly — `crop/640x480/10,20`, `filter/adaris/50` — as a
 * template literal typed against `OperationLiteral`. The `satisfies` clause
 * below is the typo guard: it fails the build if a writer produces a string
 * the union does not accept, which is what the previous per-operation
 * creators validated at runtime (`__DEV__`-only, so production shipped the
 * checking machinery without the checks). What is lost by moving off the
 * creators is dev-only numeric range checking (e.g. `brightness(500)`
 * throwing).
 */
const OPERATION_WRITERS = {
  enhance: (value: number) => `enhance/${value}` as const,
  brightness: (value: number) => `brightness/${value}` as const,
  exposure: (value: number) => `exposure/${value}` as const,
  gamma: (value: number) => `gamma/${value}` as const,
  contrast: (value: number) => `contrast/${value}` as const,
  saturation: (value: number) => `saturation/${value}` as const,
  vibrance: (value: number) => `vibrance/${value}` as const,
  warmth: (value: number) => `warmth/${value}` as const,
  filter: ({ name, amount }: NonNullable<Transformations['filter']>) => `filter/${name}/${amount}` as const,
  mirror: () => 'mirror' as const,
  flip: () => 'flip' as const,
  rotate: (value: number) => `rotate/${value}` as const,
  crop: ({ dimensions, coords }: NonNullable<Transformations['crop']>) =>
    `crop/${dimensions[0]}x${dimensions[1]}/${coords[0]},${coords[1]}` as const,
} satisfies { [K in (typeof SUPPORTED_OPERATIONS_ORDERED)[number]]: (value: never) => OperationLiteral };

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
 * Build transformations into operations, in the editor's fixed order. Values
 * equal to their default are omitted — a deliberate "don't bloat the URL"
 * policy, and the reason an explicit `brightness/0` does not survive a
 * round-trip.
 */
export function transformationsToOperations(transformations: Transformations): CdnOperation[] {
  const literals: OperationLiteral[] = [];
  for (const operation of SUPPORTED_OPERATIONS_ORDERED) {
    const value = transformations[operation];
    if (!isMeaningful(operation, value)) {
      continue;
    }
    const write = OPERATION_WRITERS[operation] as (value: Transformations[typeof operation]) => OperationLiteral;
    literals.push(write(value));
  }

  // A template literal cannot throw the way a creator could, so there is
  // nothing left here to catch. The parse below is not circular: it is the
  // same `operationsFromModifiers` that already turns loose user strings into
  // `CdnOperation[]` elsewhere, and `parseOperations` is in this bundle
  // regardless — `withOperations` needs structure, not a string.
  return operationsFromModifiers(modifiers(...literals));
}

/** Applied to every editor-generated URL. */
export const COMMON_OPERATIONS: CdnOperation[] = operationsFromModifiers(modifiers('format/auto', 'progressive/yes'));

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
    dimensions: dimensions.split('x').map(Number),
    coords: deserializeCsv(alignment).map(Number),
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

export function operationsToTransformations(operations: readonly CdnOperation[]): Transformations {
  const transformations: Partial<Record<keyof Transformations, unknown>> = {};
  for (const operation of operations) {
    const { name, params: args } = operation;
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
          // Include the params: `crop` alone doesn't say which syntax was rejected,
          // and an unrepresentable crop is the most common reason to land here.
          `Failed to parse URL operation "${[name, ...args].join('/')}". It will be ignored.`,
          err instanceof Error ? `Error message: "${err.message}"` : err,
          'If you need this functionality, please feel free to open an issue at https://github.com/uploadcare/blocks/issues/new',
        ].join('\n'),
      );
    }
  }

  return transformations as Transformations;
}
