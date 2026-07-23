import { describe, expect, it } from 'vitest';
import { resolveConfigDescriptor } from '../../abstract/config-descriptor';
import { BUILTIN_DESCRIPTORS } from './builtin-descriptors';
import { initialConfig } from './initialConfig';

describe('BUILTIN_DESCRIPTORS', () => {
  it('has a descriptor for every built-in key, including debug', () => {
    expect(BUILTIN_DESCRIPTORS.has('debug')).toBe(true);
    expect(BUILTIN_DESCRIPTORS.has('pubkey')).toBe(true);
    expect(BUILTIN_DESCRIPTORS.get('multiple')?.defaultValue).toBe(initialConfig.multiple);
  });

  it('describes a boolean key with wire-faithful serialize + normalize-based deserialize', () => {
    const d = BUILTIN_DESCRIPTORS.get('multiple');
    expect(d?.attribute).toBe(true);
    // Deserialization (string → typed) is `normalize`; `toAttribute` serializes.
    expect(d?.normalize('true')).toBe(true);
    expect(d?.toAttribute(true as never)).toBe('true');
    expect(d?.toAttribute(false as never)).toBe('false');
    // Built-in `fromAttribute` is the identity pre-parse hook — normalize does the coercion.
    expect(d?.fromAttribute('false')).toBe('false');
  });

  it('describes a number key', () => {
    const d = BUILTIN_DESCRIPTORS.get('thumbSize');
    expect(d?.normalize('200')).toBe(200);
    expect(d?.toAttribute(200 as never)).toBe('200');
    expect(d?.fromAttribute('200')).toBe('200'); // identity; normalize('200') → 200
  });

  it('marks complex (object/function) keys as non-attribute', () => {
    expect(BUILTIN_DESCRIPTORS.get('metadata')?.attribute).toBe(false);
    expect(BUILTIN_DESCRIPTORS.get('fileValidators')?.attribute).toBe(false);
    expect(BUILTIN_DESCRIPTORS.get('iconHrefResolver')?.attribute).toBe(false);
  });

  it('null/undefined removes the attribute (toAttribute ⇒ null)', () => {
    const d = BUILTIN_DESCRIPTORS.get('pubkey');
    expect(d?.toAttribute(null as never)).toBeNull();
    expect(d?.toAttribute(undefined as never)).toBeNull();
  });
});

describe('resolveConfigDescriptor', () => {
  it('fills defaults for a bare definition (attribute true, identity normalize, String serialize)', () => {
    const d = resolveConfigDescriptor({ name: 'foo', defaultValue: 'bar' });
    expect(d.attribute).toBe(true);
    expect(d.normalize('x')).toBe('x'); // identity
    expect(d.toAttribute('x')).toBe('x');
    expect(d.fromAttribute('x')).toBe('x'); // fromAttribute defaults to identity
    expect(d.toAttribute(null as never)).toBeNull();
  });

  it('honors an explicit attribute:false and custom from/to/normalize', () => {
    const d = resolveConfigDescriptor<number>({
      name: 'n',
      defaultValue: 0,
      attribute: false,
      normalize: (v) => Number(v),
      toAttribute: (v) => `#${v}`,
      fromAttribute: (raw) => Number((raw ?? '').replace('#', '')),
    });
    expect(d.attribute).toBe(false);
    expect(d.normalize('5')).toBe(5);
    expect(d.toAttribute(5)).toBe('#5');
    expect(d.fromAttribute('#7')).toBe(7);
  });
});
