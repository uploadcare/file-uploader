import { expectTypeOf, test } from 'vitest';
import { loadFileUploaderFrom, type UC_WINDOW_KEY } from '../../dist/abstract/loadFileUploaderFrom';
import { type PACKAGE_NAME, PACKAGE_VERSION } from '../../dist/env';

/** The two typed subpath exports besides the root: `./env` and `./abstract/loadFileUploaderFrom.js`. */

test('env exposes the package name as a literal and the version as a string', () => {
  expectTypeOf<typeof PACKAGE_NAME>().toEqualTypeOf<'blocks'>();
  expectTypeOf(PACKAGE_VERSION).toEqualTypeOf<string>();
});

test('loadFileUploaderFrom takes a url and an optional register flag', () => {
  expectTypeOf<typeof UC_WINDOW_KEY>().toEqualTypeOf<'UC'>();
  expectTypeOf(loadFileUploaderFrom('https://cdn.example/uc.js')).toExtend<Promise<Record<string, unknown> | null>>();
  expectTypeOf(loadFileUploaderFrom('https://cdn.example/uc.js', true)).toExtend<
    Promise<Record<string, unknown> | null>
  >();
  // @ts-expect-error url is required
  loadFileUploaderFrom();
});
