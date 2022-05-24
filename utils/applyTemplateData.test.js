import { expect } from '@esm-bundle/chai';
import { applyTemplateData } from './applyTemplateData.js';

describe('applyTemplateData', () => {
  it('should return the same string if no variables passed', () => {
    let result = applyTemplateData('Hello world!');
    expect(result).to.equal('Hello world!');
  });

  it('should replace variables', () => {
    let result = applyTemplateData("Hello world! My name is {{name}}. I'm {{age}} years old.", {
      name: 'John Doe',
      age: 12,
    });
    expect(result).to.equal("Hello world! My name is John Doe. I'm 12 years old.");
  });

  it('should replace deep variables', () => {
    let result = applyTemplateData("Hello world! My name is {{deep.name}}. I'm {{deep.age}} years old.", {
      deep: {
        name: 'John Doe',
        age: 12,
      },
    });
    expect(result).to.equal("Hello world! My name is John Doe. I'm 12 years old.");
  });

  it('should work with variables at start/end', () => {
    const result = applyTemplateData("{{name}} my name is. I'm {{age}}", { name: 'John Doe', age: 12 });
    expect(result).to.equal("John Doe my name is. I'm 12");
  });

  it('should work with single variable', () => {
    const result = applyTemplateData('{{name}}', { name: 'John Doe' });
    expect(result).to.equal('John Doe');
  });

  it('should not replace non-defined variabled', () => {
    let result = applyTemplateData('My name is {{name}}');
    expect(result).to.equal('My name is {{name}}');
  });

  it('should accept `transform` option', () => {
    let result = applyTemplateData(
      'My name is {{name}}',
      { name: 'John Doe' },
      { transform: (value) => value.toUpperCase() }
    );
    expect(result).to.equal('My name is JOHN DOE');
  });
});
