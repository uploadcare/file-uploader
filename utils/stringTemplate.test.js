import { expect } from '@esm-bundle/chai';
import { stringTemplate } from './stringTemplate.js';

describe('stringTemplate', () => {
  it('should return the same string if no variables are passed', () => {
    expect(stringTemplate('Hello world!')).to.equal('Hello world!');
  });
});
