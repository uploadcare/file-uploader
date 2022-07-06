import { expect } from '@esm-bundle/chai';
import { mergeMimeTypes } from './mergeMimeTypes';

describe('mergeMimeTypes', () => {
  it('should join input strings with comma', () => {
    expect(mergeMimeTypes('text/html,text/plain', 'image/*,image/heic', 'text/markdown')).to.equal(
      'text/html,text/plain,image/*,image/heic,text/markdown'
    );
  });

  it('should skip empty values', () => {
    expect(mergeMimeTypes()).to.equal('');
    expect(mergeMimeTypes('text/html', '', undefined, 'text/plain')).to.equal('text/html,text/plain');
  });
});
