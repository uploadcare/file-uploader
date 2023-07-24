import { expect } from '@esm-bundle/chai';
import { toKebabCase } from './toKebabCase';

describe('toKebabCase', () => {
  it('should convert camel string to kebab', () => {
    expect(toKebabCase('foo')).to.be.equal('foo');
    expect(toKebabCase('foo1')).to.be.equal('foo1');
    expect(toKebabCase('fooBar')).to.be.equal('foo-bar');
    expect(toKebabCase('fooBar1')).to.be.equal('foo-bar1');
  });
});
