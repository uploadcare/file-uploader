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
import type { CdnOperation } from '../../../../utils/cdn';
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
 * Build transformations into operations, in the editor's fixed order. Values
 * equal to their default are omitted — a deliberate "don't bloat the URL"
 * policy, and the reason an explicit `brightness/0` does not survive a
 * round-trip.
 */
export function transformationsToOperations(transformations: Transformations): CdnOperation[] {
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

  return operations;
}

/** Applied to every editor-generated URL. */
export const COMMON_OPERATIONS: CdnOperation[] = [format('auto'), progressive(true)];

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

const MODELLED_OPERATION_NAMES: ReadonlySet<string> = new Set(SUPPORTED_OPERATIONS_ORDERED);

/** The transformations that change geometry — the tail of the canonical order. */
const GEOMETRY_OPERATION_NAMES: ReadonlySet<string> = new Set(['mirror', 'flip', 'rotate', 'crop']);

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

/**
 * The source operations the editor cannot model, with its own `preview`
 * marker dropped. These are rendered as-is and survive an edit untouched — a
 * watermark `overlay`, a `blur`, a `resize` the UI has no control for.
 */
export function preservedOperations(source: readonly CdnOperation[]): CdnOperation[] {
  return source.filter((operation) => operation.name !== 'preview' && !MODELLED_OPERATION_NAMES.has(operation.name));
}

/**
 * Edit the source URL's operations in place rather than rebuilding the list
 * from scratch and appending what the editor cannot model. Placement matters
 * to the CDN for some pairs (`stretch` applies to a *following* resize), so an
 * operation the editor does not model stays exactly where the source had it —
 * except for the editor's own geometry operations, which always move to the
 * end (see below).
 *
 * Rules:
 * - A modelled *appearance* operation (anything but `mirror`/`flip`/`rotate`/
 *   `crop`) present in `source` and still meaningful in `transformations` is
 *   replaced in its existing slot with what the corresponding creator
 *   produces for the current value.
 * - A modelled operation present in `source` but no longer meaningful (unset,
 *   or equal to its default — see `isMeaningful`) is removed; its slot
 *   disappears rather than being left empty.
 * - A modelled appearance operation that is meaningful in `transformations`
 *   but absent from `source` is appended after the last source operation, in
 *   the editor's canonical `SUPPORTED_OPERATIONS_ORDERED` order relative to
 *   other newly-added ones.
 * - The editor's geometry operations (`mirror`, `flip`, `rotate`, `crop`) are
 *   always emitted last, regardless of where the source had them. `crop`
 *   coordinates are only meaningful relative to a point in the operation
 *   chain, and putting geometry after everything preserved makes that point
 *   unconditionally "original + preserved operations".
 * - An operation the editor does not model is kept verbatim, in place.
 * - Every `preview` in `source` is dropped. The merge itself no longer
 *   appends one — that marker belongs to the applied URL (`editorAppliedUrl`),
 *   so an open/apply cycle never stacks markers.
 * - A modelled operation appearing more than once in `source` keeps the
 *   position of its *last* occurrence; earlier occurrences are dropped. That
 *   matches `operationsToTransformations`, where a later occurrence overwrites
 *   an earlier one, so reading and writing agree on which occurrence wins.
 */
export function mergeTransformationsIntoOperations(
  source: readonly CdnOperation[],
  transformations: Transformations,
): CdnOperation[] {
  const modelled = transformationsToOperations(transformations);
  // Geometry operations are emitted last, whatever position the source had
  // them in. `crop` coordinates are only meaningful relative to a point in
  // the chain, and putting them after everything preserved makes that point
  // unconditionally "original + preserved" — which is the space `_imageSize`
  // measures.
  const geometry = modelled.filter((operation) => GEOMETRY_OPERATION_NAMES.has(operation.name));
  const appearance = modelled.filter((operation) => !GEOMETRY_OPERATION_NAMES.has(operation.name));
  const appearanceByName = new Map(appearance.map((operation) => [operation.name, operation]));

  const lastAppearanceIndexByName = new Map<string, number>();
  source.forEach((operation, index) => {
    if (MODELLED_OPERATION_NAMES.has(operation.name) && !GEOMETRY_OPERATION_NAMES.has(operation.name)) {
      lastAppearanceIndexByName.set(operation.name, index);
    }
  });

  const placedNames = new Set<string>();
  const merged: CdnOperation[] = [];
  source.forEach((operation, index) => {
    // The editor's own marker and its geometry operations are re-emitted
    // below, so the source's copies are dropped here rather than duplicated.
    if (operation.name === 'preview' || GEOMETRY_OPERATION_NAMES.has(operation.name)) {
      return;
    }
    if (!MODELLED_OPERATION_NAMES.has(operation.name)) {
      merged.push(operation);
      return;
    }
    // An earlier occurrence of a repeated modelled operation: its slot is
    // dropped, only the last occurrence's position survives.
    if (lastAppearanceIndexByName.get(operation.name) !== index) {
      return;
    }
    const replacement = appearanceByName.get(operation.name);
    if (replacement) {
      merged.push(replacement);
      placedNames.add(operation.name);
    }
  });

  for (const operation of appearance) {
    if (!placedNames.has(operation.name)) {
      merged.push(operation);
    }
  }

  return [...merged, ...geometry];
}
