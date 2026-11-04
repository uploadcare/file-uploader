import { describe, expectTypeOf, it } from 'vitest';
import type { ConfigHost } from './config-host-types';

// Compile-time assertions: `expectTypeOf` is erased at runtime, so these verify
// the derived surface at type-check time (tsc:test) without dereferencing a
// value. They fail the build if inference degrades to `any` or a key/optionality
// drifts from `ConfigType`.
describe('ConfigHost type surface', () => {
  it('exposes typed built-in config props derived from ConfigType', () => {
    expectTypeOf<ConfigHost['multiple']>().toEqualTypeOf<boolean>();
    expectTypeOf<ConfigHost['pubkey']>().toEqualTypeOf<string>();
    expectTypeOf<ConfigHost['multipleMax']>().toEqualTypeOf<number>();
  });

  it('derives the attributesMeta shape (required ctx-name, optional plain keys)', () => {
    expectTypeOf<ConfigHost['attributesMeta']['ctx-name']>().toEqualTypeOf<string>();
    expectTypeOf<ConfigHost['attributesMeta']['multiple']>().toEqualTypeOf<boolean | undefined>();
  });
});
