import { expect } from '@esm-bundle/chai';
import { stringTemplate } from './stringTemplate.js';

describe('stringTemplate', () => {
  it('should return the same string if no variables passed', () => {
    let { string } = stringTemplate('Hello world!');
    expect(string).to.equal('Hello world!');
  });

  it('should replace variables', () => {
    let { string } = stringTemplate("Hello world! My name is {{name}}. I'm {{age}} years old.", {
      name: 'John Doe',
      age: 12,
    });
    expect(string).to.equal("Hello world! My name is John Doe. I'm 12 years old.");
  });

  it('should work with variables at start/end', () => {
    const { string } = stringTemplate("{{name}} my name is. I'm {{age}}", { name: 'John Doe', age: 12 });
    expect(string).to.equal("John Doe my name is. I'm 12");
  });

  it('should work with single variable', () => {
    const { string } = stringTemplate('{{name}}', { name: 'John Doe' });
    expect(string).to.equal('John Doe');
  });

  it("should replace variable with special string when it's not found", () => {
    let { string } = stringTemplate('My name is {{name}}');
    expect(string).to.equal('My name is __KEY_NOT_FOUND__');
  });

  it('should return empty missingKeys when there are no missing keys', () => {
    let { missingKeys } = stringTemplate('My name is {{name}}', { name: 'John Doe' });
    expect(missingKeys).to.deep.equal([]);
  });

  it('should return missing keys inside missingKeys', () => {
    let { missingKeys } = stringTemplate('My name is {{name}}');
    expect(missingKeys).to.deep.equal(['name']);
  });
});
