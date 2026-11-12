import {
  type CdnOperation,
  modifiers,
  type OperationLiteral,
  serializeOperations,
  unsafeOperation,
} from '@uploadcare/cdn-url';
import { describe, expect, it } from 'vitest';
import { operationsFromModifiers } from '../../../../utils/cdn/operations';
import type { Transformations } from '../types';
import {
  COMMON_OPERATIONS,
  OPERATIONS_DEFAULTS,
  operationsToTransformations,
  transformationsToOperations,
} from './transformationUtils';

/**
 * Characterisation tests: these pin the CURRENT behaviour of the editor's
 * URL↔`Transformations` round-trip before it is rebuilt on `@uploadcare/cdn-url`.
 * The module had no unit coverage despite three production call sites and it is
 * the least forgiving code in the CDN-URL area, so the assertions below describe
 * what the code does today — including the quirks — rather than what it ideally
 * would do.
 *
 * One quirk remains labelled `PRE-FIX` where it appears: a value equal to its
 * default is indistinguishable from "unset", so an explicitly-set `brightness: 0`
 * never reaches the URL. When that is fixed, exactly those assertions should flip,
 * and the diff should say so out loud.
 *
 * The other `PRE-FIX` quirk — an unmodelled operation being lost across an edit —
 * is the v1 behaviour 1.x keeps (see the NEXT-MAJOR note in `CloudImageEditorBlock`).
 */
/**
 * Both `transformationsToOperations` and `operationsToTransformations` work
 * with structured `CdnOperation[]`. To exercise a genuine round-trip through
 * the wire format (as production does via `parseFileUrl`), serialise to a URL
 * fragment and parse it back rather than passing the structured list straight
 * through.
 */
const toOperations = (transformations: Transformations): CdnOperation[] =>
  operationsFromModifiers(serializeOperations(transformationsToOperations(transformations)));

/**
 * Build `CdnOperation`s from typed operation literals — the same `OperationLiteral`
 * union production authors with, so a typo in a fixture fails the build instead of
 * quietly asserting against a URL the CDN would reject.
 *
 * Reader tests deliberately feed input the union rejects (an unknown filter, crop
 * syntax the editor cannot represent, a bare `brightness` with no value). Those wrap
 * it in `unsafeOperation`, which is the marker that the garbage is the point.
 */
const ops = (...fragments: OperationLiteral[]): CdnOperation[] => operationsFromModifiers(modifiers(...fragments));

describe('transformationsToOperations', () => {
  it('emits nothing for empty transformations', () => {
    expect(serializeOperations(transformationsToOperations({}))).toBe('');
  });

  it('serialises a number operation as `name/value`', () => {
    expect(serializeOperations(transformationsToOperations({ brightness: 50 }))).toBe('-/brightness/50/');
  });

  it('serialises a true boolean operation as a bare name, no value', () => {
    expect(serializeOperations(transformationsToOperations({ mirror: true }))).toBe('-/mirror/');
  });

  it('serialises filter as `filter/name/amount`', () => {
    expect(serializeOperations(transformationsToOperations({ filter: { name: 'adaris', amount: 70 } }))).toBe(
      '-/filter/adaris/70/',
    );
  });

  it('serialises crop as `crop/WxH/x,y`', () => {
    expect(
      serializeOperations(transformationsToOperations({ crop: { dimensions: [640, 480], coords: [10, 20] } })),
    ).toBe('-/crop/640x480/10,20/');
  });

  it('joins multiple operations with the `/-/` delimiter', () => {
    expect(serializeOperations(transformationsToOperations({ brightness: 50, contrast: 20 }))).toBe(
      '-/brightness/50/-/contrast/20/',
    );
  });

  it('emits operations in its own fixed order, not the order of the input object', () => {
    // `crop` is declared last in SUPPORTED_OPERATIONS_ORDERED, `enhance` first.
    const transformations: Transformations = {
      crop: { dimensions: [100, 100], coords: [0, 0] },
      rotate: 90,
      enhance: 30,
    };

    expect(serializeOperations(transformationsToOperations(transformations))).toBe(
      '-/enhance/30/-/rotate/90/-/crop/100x100/0,0/',
    );
  });

  it('skips keys that are undefined or null', () => {
    const transformations = { brightness: undefined, contrast: null, saturation: 10 } as unknown as Transformations;

    expect(serializeOperations(transformationsToOperations(transformations))).toBe('-/saturation/10/');
  });

  // PRE-FIX: a value that happens to equal its default is elided, so an
  // explicitly-set `brightness: 0` is indistinguishable from "not set" once the
  // URL has been written. Documented here so the loss is visible.
  it.each([
    ['brightness', 0],
    ['exposure', 0],
    ['gamma', 100],
    ['contrast', 0],
    ['saturation', 0],
    ['vibrance', 0],
    ['warmth', 0],
    ['enhance', 0],
    ['rotate', 0],
  ] as const)('PRE-FIX: drops %s when the value equals its default (%s)', (operation, value) => {
    expect(OPERATIONS_DEFAULTS[operation]).toBe(value);
    expect(serializeOperations(transformationsToOperations({ [operation]: value }))).toBe('');
  });

  it('PRE-FIX: drops a false boolean, matching its default', () => {
    expect(serializeOperations(transformationsToOperations({ mirror: false, flip: false }))).toBe('');
  });

  it('PRE-FIX: drops filter entirely when its amount equals the default (0)', () => {
    expect(serializeOperations(transformationsToOperations({ filter: { name: 'adaris', amount: 0 } }))).toBe('');
  });
});

describe('COMMON_OPERATIONS', () => {
  it('is the fixed pair every editor URL carries', () => {
    expect(serializeOperations(COMMON_OPERATIONS)).toBe('-/format/auto/-/progressive/yes/');
  });
});

describe('operationsToTransformations', () => {
  it('returns an empty object for no operations', () => {
    expect(operationsToTransformations([])).toEqual({});
  });

  it('parses number operations, coercing the value', () => {
    expect(operationsToTransformations(ops('brightness/50', 'rotate/90'))).toEqual({ brightness: 50, rotate: 90 });
  });

  it('parses a valueless boolean operation as true', () => {
    expect(operationsToTransformations(ops('mirror', 'flip'))).toEqual({ mirror: true, flip: true });
  });

  it('parses a boolean operation as true even when it carries a value', () => {
    // `asBoolean` ignores its arguments entirely.
    expect(operationsToTransformations(ops(unsafeOperation('mirror/anything')))).toEqual({ mirror: true });
  });

  it('parses filter with its amount', () => {
    expect(operationsToTransformations(ops('filter/adaris/70'))).toEqual({ filter: { name: 'adaris', amount: 70 } });
  });

  it('defaults a filter with no amount to 100', () => {
    expect(operationsToTransformations(ops('filter/adaris'))).toEqual({ filter: { name: 'adaris', amount: 100 } });
  });

  /**
   * CHANGED (was: accepted verbatim). A filter name off a URL is untrusted, and
   * `Transformations['filter'].name` is now the library's `FilterName`, so the
   * name is validated against the CDN's own list. An unrecognised one is skipped
   * like unsupported crop syntax instead of being typed as something it isn't.
   */
  it('skips a filter whose name the CDN does not offer', () => {
    expect(operationsToTransformations(ops(unsafeOperation('filter/notarealfilter/50')))).toEqual({});
  });

  it('keeps parsing later operations after skipping an unknown filter', () => {
    expect(operationsToTransformations(ops(unsafeOperation('filter/notarealfilter/50'), 'brightness/50'))).toEqual({
      brightness: 50,
    });
  });

  it('parses a pixel crop into dimensions and coords', () => {
    expect(operationsToTransformations(ops('crop/640x480/10,20'))).toEqual({
      crop: { dimensions: [640, 480], coords: [10, 20] },
    });
  });

  it('yields undefined for a number operation with no value', () => {
    // `toStrictEqual`, not `toEqual`: the latter ignores undefined-valued keys, so
    // it would pass just as happily against `{}` — and "the key is present holding
    // undefined" is the whole claim here.
    expect(operationsToTransformations(ops(unsafeOperation('brightness')))).toStrictEqual({ brightness: undefined });
  });

  it('lets a later occurrence of the same operation win', () => {
    expect(operationsToTransformations(ops('brightness/10', 'brightness/90'))).toEqual({ brightness: 90 });
  });

  // The crop parser deliberately rejects syntax the editor UI cannot represent;
  // rejection is swallowed with a warning and the operation is skipped.
  it.each([
    ['aspect-ratio crop', 'crop/1:1/center'],
    ['percentage crop', 'crop/50p50p/10p,10p'],
    ['alignment-preset crop', 'crop/640x480/center'],
    ['malformed crop', 'crop/nonsense'],
  ])('skips %s rather than throwing', (_label, operation) => {
    expect(operationsToTransformations(ops(unsafeOperation(operation)))).toEqual({});
  });

  it('keeps parsing later operations after skipping an unsupported crop', () => {
    expect(operationsToTransformations(ops('crop/1:1/center', 'brightness/50'))).toEqual({ brightness: 50 });
  });

  // An operation the editor does not model is absent from `Transformations` — the
  // reader only knows the operations the UI can represent, and Apply rebuilds from
  // `Transformations`, so an unmodelled operation is lost across an edit, as in v1
  // (see the NEXT-MAJOR note in `CloudImageEditorBlock`).
  it.each([
    ['resize', 'resize/300x'],
    ['format', 'format/auto'],
    ['progressive', 'progressive/yes'],
    ['stretch', 'stretch/off'],
    ['blur', 'blur/20'],
    ['preview', 'preview/800x600'],
    ['an internal @-operation', '@clib/uc-img/1.0'],
  ])('does not model the operation %s, so it is absent from Transformations', (_label, operation) => {
    expect(operationsToTransformations(ops(unsafeOperation(operation)))).toEqual({});
  });

  it('PRE-FIX: drops unmodelled operations even when mixed with modelled ones', () => {
    expect(operationsToTransformations(ops('format/auto', 'brightness/50', 'blur/20'))).toEqual({ brightness: 50 });
  });
});

describe('round-trip', () => {
  it('preserves every modelled operation whose value differs from its default', () => {
    const transformations: Transformations = {
      enhance: 30,
      brightness: 50,
      exposure: -20,
      gamma: 120,
      contrast: 10,
      saturation: 15,
      vibrance: 25,
      warmth: 35,
      filter: { name: 'adaris', amount: 70 },
      mirror: true,
      flip: true,
      rotate: 90,
      crop: { dimensions: [640, 480], coords: [10, 20] },
    };

    expect(operationsToTransformations(toOperations(transformations))).toEqual(transformations);
  });

  it('PRE-FIX: loses a default-valued operation across the round-trip', () => {
    const transformations: Transformations = { brightness: 0, contrast: 25 };

    // `brightness: 0` never reached the URL, so it cannot come back.
    expect(operationsToTransformations(toOperations(transformations))).toEqual({ contrast: 25 });
  });
});
