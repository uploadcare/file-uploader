import { expect } from '@esm-bundle/chai';
import { getProperty } from './getProperty';

describe('getProperty', () => {
  it('should return property of object by path', () => {
    expect(getProperty({ foo: 'bar' }, 'foo')).to.eq('bar');
  });

  it('should return deep property of object by path', () => {
    expect(getProperty({ foo: { bar: 'baz' } }, 'foo.bar')).to.eq('baz');
  });

  it('should return undefined if property not exist', () => {
    expect(getProperty(undefined, 'other')).to.eq(undefined);
    expect(getProperty({ foo: 'bar' }, 'other')).to.eq(undefined);
    expect(getProperty({ foo: { bar: 'baz' } }, 'other')).to.eq(undefined);
    expect(getProperty({ foo: { bar: 'baz' } }, 'bar.other')).to.eq(undefined);
  });
});
