import { expectAssignable, expectType } from 'tsd';
import { loadFileUploaderFrom, UC_WINDOW_KEY } from '../../dist/abstract/loadFileUploaderFrom';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../dist/env';

/** The two typed subpath exports besides the root: `./env` and `./abstract/loadFileUploaderFrom.js`. */

expectType<'blocks'>(PACKAGE_NAME);
expectType<string>(PACKAGE_VERSION);

expectType<'UC'>(UC_WINDOW_KEY);
expectAssignable<Promise<Record<string, unknown> | null>>(loadFileUploaderFrom('https://cdn.example/uc.js'));
expectAssignable<Promise<Record<string, unknown> | null>>(loadFileUploaderFrom('https://cdn.example/uc.js', true));
// @ts-expect-error url is required
loadFileUploaderFrom();
