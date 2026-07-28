import {
  blur,
  brightness,
  contrast,
  enhance,
  mirror as mirrorOp,
  overlay,
  preview,
  resize,
  rotate,
  stretch,
} from '@uploadcare/cdn-url/ops';
import { describe, expect, it } from 'vitest';
import { type CdnOperation, operationsFromModifiers, serializeOperations } from '../../../../utils/cdn';
import type { Transformations } from '../types';
import {
  COMMON_OPERATIONS,
  mergeTransformationsIntoOperations,
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
 * Two of those quirks are slated to change and are labelled `PRE-FIX` where they
 * appear: unmodelled operations being dropped, and a value equal to its default
 * being indistinguishable from "unset". When the fix lands, exactly those
 * assertions should flip, and the diff should say so out loud.
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

/** Build bare `CdnOperation`s from `name/param/param` fragments, for reader tests. */
const ops = (...fragments: string[]): CdnOperation[] => operationsFromModifiers(...fragments);

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

  it('emits nothing for a value whose shape it cannot serialise', () => {
    // Defensive fallthrough: a non-number, non-boolean value on an operation
    // that is not `filter`/`crop` (reachable only from malformed state, but the
    // rebuilt implementation must stay equally quiet rather than emit garbage).
    const transformations = { rotate: {} } as unknown as Transformations;

    expect(serializeOperations(transformationsToOperations(transformations))).toBe('');
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
    expect(operationsToTransformations(ops('mirror/anything'))).toEqual({ mirror: true });
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
    expect(operationsToTransformations(ops('filter/notarealfilter/50'))).toEqual({});
  });

  it('keeps parsing later operations after skipping an unknown filter', () => {
    expect(operationsToTransformations(ops('filter/notarealfilter/50', 'brightness/50'))).toEqual({ brightness: 50 });
  });

  it('parses a pixel crop into dimensions and coords', () => {
    expect(operationsToTransformations(ops('crop/640x480/10,20'))).toEqual({
      crop: { dimensions: [640, 480], coords: [10, 20] },
    });
  });

  it('yields undefined for a number operation with no value', () => {
    expect(operationsToTransformations(ops('brightness'))).toEqual({ brightness: undefined });
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
    expect(operationsToTransformations(ops(operation))).toEqual({});
  });

  it('keeps parsing later operations after skipping an unsupported crop', () => {
    expect(operationsToTransformations(ops('crop/1:1/center', 'brightness/50'))).toEqual({ brightness: 50 });
  });

  // PRE-FIX: this is the silent data loss. Any operation the editor does not
  // model is discarded on read, and because Apply rebuilds the URL from
  // `Transformations` alone, it never comes back.
  it.each([
    ['resize', 'resize/300x'],
    ['format', 'format/auto'],
    ['progressive', 'progressive/yes'],
    ['stretch', 'stretch/off'],
    ['blur', 'blur/20'],
    ['preview', 'preview/800x600'],
    ['an internal @-operation', '@clib/uc-img/1.0'],
  ])('PRE-FIX: silently drops the unmodelled operation %s', (_label, operation) => {
    expect(operationsToTransformations(ops(operation))).toEqual({});
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

describe('mergeTransformationsIntoOperations', () => {
  it('produces just the modelled operations plus a trailing preview for a source with no operations', () => {
    // Must stay byte-identical to the pre-refactor `[...modelled, preview()]` —
    // the common case (a fresh source URL) must not change at all.
    expect(mergeTransformationsIntoOperations([], { brightness: 50, rotate: 90 })).toEqual([
      ...transformationsToOperations({ brightness: 50, rotate: 90 }),
      preview(),
    ]);
  });

  it('replaces a modelled operation in its existing position when still set', () => {
    const source = [blur(20), brightness(10), contrast(5)];

    expect(mergeTransformationsIntoOperations(source, { brightness: 90, contrast: 5 })).toEqual([
      blur(20),
      brightness(90),
      contrast(5),
      preview(),
    ]);
  });

  it('removes a modelled operation whose value has gone back to its default', () => {
    // The new test the brief calls out: a modelled operation present in the
    // source disappears entirely (not left as an empty slot) once its value
    // reverts to the default `isMeaningful` would omit.
    const source = [brightness(50), contrast(10)];

    expect(mergeTransformationsIntoOperations(source, { brightness: 0, contrast: 10 })).toEqual([
      contrast(10),
      preview(),
    ]);
  });

  it('appends a newly-set modelled operation absent from source, in canonical order', () => {
    const source = [blur(20)];

    // `enhance` sorts before `rotate` in SUPPORTED_OPERATIONS_ORDERED.
    expect(mergeTransformationsIntoOperations(source, { rotate: 90, enhance: 30 })).toEqual([
      blur(20),
      enhance(30),
      rotate(90),
      preview(),
    ]);
  });

  it('keeps an unmodelled operation verbatim, in place, interleaved with modelled ones', () => {
    // The other new test the brief calls out: placement of an unmodelled
    // operation sitting *between* modelled ones must survive, not just its
    // presence.
    const source = [brightness(50), blur(20), contrast(10)];

    expect(mergeTransformationsIntoOperations(source, { brightness: 50, contrast: 10 })).toEqual([
      brightness(50),
      blur(20),
      contrast(10),
      preview(),
    ]);
  });

  it('keeps an operation the editor does not model in place, brief example', () => {
    // `-/blur/20/-/brightness/50/` now applies as `-/blur/20/-/brightness/50/-/preview/`,
    // not `-/brightness/50/-/blur/20/-/preview/` (the old append-at-the-end order).
    const source = operationsFromModifiers('-/blur/20/-/brightness/50/');

    expect(mergeTransformationsIntoOperations(source, { brightness: 50 })).toEqual([
      blur(20),
      brightness(50),
      preview(),
    ]);
  });

  it('drops every preview in source and appends exactly one at the end', () => {
    const source = [preview(), brightness(50), preview(1000, 400)];

    expect(mergeTransformationsIntoOperations(source, { brightness: 50 })).toEqual([brightness(50), preview()]);
  });

  it('keeps the position of the last occurrence of a repeated modelled operation and drops earlier ones', () => {
    // Matches `operationsToTransformations`, where a later occurrence wins on
    // read — so the position that survives on write is the one whose value
    // was actually read.
    const source = [brightness(10), blur(20), brightness(90)];

    expect(mergeTransformationsIntoOperations(source, { brightness: 90 })).toEqual([
      blur(20),
      brightness(90),
      preview(),
    ]);
  });

  it('keeps an unmodelled operation in place even when the transformations are empty', () => {
    const source = [overlay('wm-uuid'), resize({ width: 300 })];

    expect(mergeTransformationsIntoOperations(source, {})).toEqual([
      overlay('wm-uuid'),
      resize({ width: 300 }),
      preview(),
    ]);
  });

  it('mixes replace-in-place, removal, append and passthrough together', () => {
    const source = [stretch('off'), brightness(10), overlay('wm-uuid'), contrast(5), preview()];

    expect(mergeTransformationsIntoOperations(source, { brightness: 90, rotate: 180 })).toEqual([
      stretch('off'),
      brightness(90),
      overlay('wm-uuid'),
      rotate(180),
      preview(),
    ]);
  });

  it('a source whose value equals the mirror op is still replaced verbatim when re-set', () => {
    const source = [mirrorOp()];

    expect(mergeTransformationsIntoOperations(source, { mirror: true })).toEqual([mirrorOp(), preview()]);
  });
});
