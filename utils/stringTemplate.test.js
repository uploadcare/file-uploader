import { expect } from '@esm-bundle/chai';
import { stringTemplate } from './stringTemplate.js';

describe('stringTemplate', () => {
  it('should return the same string if no variables are passed', () => {
    expect(stringTemplate('Hello world!')).to.equal('Hello world!');
  });

  it('should replace variables', () => {
    expect(
      stringTemplate("Hello world! My name is {{name}}. I'm {{age}} years old.", { name: 'John Doe', age: 12 })
    ).to.equal("Hello world! My name is John Doe. I'm 12 years old.");
  });

  it('should work with variables at start/end', () => {
    expect(stringTemplate("{{name}} my name is. I'm {{age}}", { name: 'John Doe', age: 12 })).to.equal(
      "John Doe my name is. I'm 12"
    );
  });

  it('should work with single variable', () => {
    expect(stringTemplate('{{name}}', { name: 'John Doe' })).to.equal('John Doe');
  });
});
