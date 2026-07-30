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
  mergeTransformationsIntoOperations,
  OPERATIONS_DEFAULTS,
  operationsToTransformations,
  preservedOperations,
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
 * The other former `PRE-FIX` quirk — an unmodelled operation being lost across an
 * edit — is fixed: `mergeTransformationsIntoOperations` edits the source operation
 * list rather than rebuilding it, so such an operation keeps its place. The reader
 * still does not model it, which is not the same thing as losing it.
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
  // reader only knows the operations the UI can represent. This is no longer data
  // loss: Apply merges the current transformations into the source operation list
  // rather than rebuilding from `Transformations`, so an unmodelled operation
  // survives an edit in its original position (see
  // `mergeTransformationsIntoOperations` below).
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

describe('mergeTransformationsIntoOperations', () => {
  it('produces just the modelled operations for a source with no operations', () => {
    // CHANGED: no longer appends `'preview'` — that marker now belongs to
    // `editorAppliedUrl`, so the merge itself stays a pure operation list.
    expect(mergeTransformationsIntoOperations([], { brightness: 50, rotate: 90 })).toEqual(
      transformationsToOperations({ brightness: 50, rotate: 90 }),
    );
  });

  it('replaces a modelled operation in its existing position when still set', () => {
    const source = ops('blur/20', 'brightness/10', 'contrast/5');

    expect(mergeTransformationsIntoOperations(source, { brightness: 90, contrast: 5 })).toEqual(
      ops('blur/20', 'brightness/90', 'contrast/5'),
    );
  });

  it('removes a modelled operation whose value has gone back to its default', () => {
    // The new test the brief calls out: a modelled operation present in the
    // source disappears entirely (not left as an empty slot) once its value
    // reverts to the default `isMeaningful` would omit.
    const source = ops('brightness/50', 'contrast/10');

    expect(mergeTransformationsIntoOperations(source, { brightness: 0, contrast: 10 })).toEqual(ops('contrast/10'));
  });

  it('appends a newly-set modelled operation absent from source, in canonical order', () => {
    const source = ops('blur/20');

    // `enhance` sorts before `rotate` in SUPPORTED_OPERATIONS_ORDERED, and
    // `rotate` is a geometry operation so it lands last regardless.
    expect(mergeTransformationsIntoOperations(source, { rotate: 90, enhance: 30 })).toEqual(
      ops('blur/20', 'enhance/30', 'rotate/90'),
    );
  });

  it('keeps an unmodelled operation verbatim, in place, interleaved with modelled ones', () => {
    // The other new test the brief calls out: placement of an unmodelled
    // operation sitting *between* modelled ones must survive, not just its
    // presence.
    const source = ops('brightness/50', 'blur/20', 'contrast/10');

    expect(mergeTransformationsIntoOperations(source, { brightness: 50, contrast: 10 })).toEqual(
      ops('brightness/50', 'blur/20', 'contrast/10'),
    );
  });

  it('keeps an operation the editor does not model in place, brief example', () => {
    // `-/blur/20/-/brightness/50/` now applies as `-/blur/20/-/brightness/50/`,
    // not `-/brightness/50/-/blur/20/` (the old append-at-the-end order).
    const source = operationsFromModifiers('-/blur/20/-/brightness/50/');

    expect(mergeTransformationsIntoOperations(source, { brightness: 50 })).toEqual(ops('blur/20', 'brightness/50'));
  });

  it('drops every preview in source and does not add a new one', () => {
    // CHANGED: the merge no longer owns the `preview` marker at all — see
    // `editorAppliedUrl` for where it is appended now.
    const source = ops('preview', 'brightness/50', 'preview/1000x400');

    expect(mergeTransformationsIntoOperations(source, { brightness: 50 })).toEqual(ops('brightness/50'));
  });

  it('keeps the position of the last occurrence of a repeated modelled operation and drops earlier ones', () => {
    // Matches `operationsToTransformations`, where a later occurrence wins on
    // read — so the position that survives on write is the one whose value
    // was actually read.
    const source = ops('brightness/10', 'blur/20', 'brightness/90');

    expect(mergeTransformationsIntoOperations(source, { brightness: 90 })).toEqual(ops('blur/20', 'brightness/90'));
  });

  it('keeps an unmodelled operation in place even when the transformations are empty', () => {
    const source = ops(unsafeOperation('overlay/wm-uuid'), 'resize/300x');

    expect(mergeTransformationsIntoOperations(source, {})).toEqual(
      ops(unsafeOperation('overlay/wm-uuid'), 'resize/300x'),
    );
  });

  it('mixes replace-in-place, removal, append and passthrough together', () => {
    const source = ops('stretch/off', 'brightness/10', unsafeOperation('overlay/wm-uuid'), 'contrast/5', 'preview');

    expect(mergeTransformationsIntoOperations(source, { brightness: 90, rotate: 180 })).toEqual(
      ops('stretch/off', 'brightness/90', unsafeOperation('overlay/wm-uuid'), 'rotate/180'),
    );
  });

  it('is idempotent for a valueless boolean that is still set', () => {
    // `mirror` carries no params, so replace-in-place and keep-in-place are
    // indistinguishable in the output by construction — this pins that re-applying
    // an unchanged boolean neither duplicates nor drops it, which is all the
    // operation's shape allows a test to check.
    const source = ops('mirror');

    expect(mergeTransformationsIntoOperations(source, { mirror: true })).toEqual(ops('mirror'));
  });

  // The editor models `crop` but its UI cannot represent an aspect-ratio,
  // percentage or alignment-keyword crop, so the reader skips those with a warning
  // and they are absent from `Transformations`. They are therefore NOT passthrough:
  // the merge drops them, exactly as the pre-refactor mechanism did. The suite that
  // used to pin this went with `extractPassthroughOperations`, so it is pinned here.
  it.each([
    ['aspect-ratio crop', 'crop/1:1/center'],
    ['percentage crop', 'crop/50p50p/10p,10p'],
    ['alignment-preset crop', 'crop/640x480/center'],
  ])('drops the modelled-but-unrepresentable %s rather than preserving it', (_label, operation) => {
    const source = ops(unsafeOperation(operation), unsafeOperation('overlay/wm-uuid'));

    // The crop's slot disappears; the genuinely unmodelled overlay keeps its place.
    expect(mergeTransformationsIntoOperations(source, {})).toEqual(ops(unsafeOperation('overlay/wm-uuid')));
  });

  it('replaces an unrepresentable crop with the one the user drew', () => {
    const source = ops('crop/1:1/center', unsafeOperation('overlay/wm-uuid'));
    const drawn = { crop: { dimensions: [640, 480], coords: [10, 20] } } as const satisfies Transformations;

    // CHANGED: the crop is now emitted after everything preserved, so its
    // coordinates are interpreted in the same space `_imageSize` measures.
    expect(mergeTransformationsIntoOperations(source, drawn)).toEqual(
      ops(unsafeOperation('overlay/wm-uuid'), 'crop/640x480/10,20'),
    );
  });

  it('appends geometry operations after preserved ones, whatever the source order', () => {
    const source = ops('crop/100x100/0,0', unsafeOperation('overlay/wm-uuid'), 'blur/20');

    // `crop` came first in the source; it now lands last, so its coordinates are
    // interpreted after the overlay and blur rather than before them.
    expect(mergeTransformationsIntoOperations(source, { crop: { dimensions: [640, 480], coords: [10, 20] } })).toEqual(
      ops(unsafeOperation('overlay/wm-uuid'), 'blur/20', 'crop/640x480/10,20'),
    );
  });

  it('keeps appearance operations in their source position', () => {
    const source = ops(unsafeOperation('overlay/wm-uuid'), 'brightness/10', 'blur/20');

    expect(mergeTransformationsIntoOperations(source, { brightness: 90 })).toEqual(
      ops(unsafeOperation('overlay/wm-uuid'), 'brightness/90', 'blur/20'),
    );
  });

  it('orders several geometry operations by the editor canonical order', () => {
    expect(
      mergeTransformationsIntoOperations([], {
        rotate: 90,
        mirror: true,
        crop: { dimensions: [10, 10], coords: [0, 0] },
      }),
    ).toEqual(ops('mirror', 'rotate/90', 'crop/10x10/0,0'));
  });

  it('no longer appends a preview marker — that belongs to the applied url', () => {
    expect(mergeTransformationsIntoOperations([], { brightness: 50 })).toEqual(ops('brightness/50'));
  });

  it('drops the source preview marker so apply cycles do not stack them', () => {
    expect(mergeTransformationsIntoOperations(ops('preview', unsafeOperation('overlay/wm-uuid')), {})).toEqual(
      ops(unsafeOperation('overlay/wm-uuid')),
    );
  });
});

describe('preservedOperations', () => {
  it('keeps only what the editor cannot model, dropping its own preview marker', () => {
    const source = ops(unsafeOperation('overlay/wm-uuid'), 'brightness/50', 'resize/300x', 'preview', 'crop/10x10');

    expect(preservedOperations(source)).toEqual(ops(unsafeOperation('overlay/wm-uuid'), 'resize/300x'));
  });

  it('returns an empty list for a source with nothing preserved', () => {
    expect(preservedOperations(ops('brightness/50', 'crop/10x10'))).toEqual([]);
  });
});
