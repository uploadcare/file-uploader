import { expect } from '@esm-bundle/chai';
import { mergeFileTypes, matchFileType, fileIsImage } from './fileTypes';

describe('mergeFileTypes', () => {
  it('should join input strings with comma', () => {
    expect(mergeFileTypes(['text/html,text/plain', 'image/*,image/heic', 'text/markdown'])).to.eql([
      'text/html',
      'text/plain',
      'image/*',
      'image/heic',
      'text/markdown',
    ]);
  });

  it('should skip empty values', () => {
    expect(mergeFileTypes()).to.eql([]);
    expect(mergeFileTypes(['text/html', '', undefined, 'text/plain'])).to.eql(['text/html', 'text/plain']);
  });

  it('should trim values', () => {
    expect(mergeFileTypes([' text/html , text/plain ', ' image/*, image/heic ', ' text/markdown '])).to.eql([
      'text/html',
      'text/plain',
      'image/*',
      'image/heic',
      'text/markdown',
    ]);
  });
});

describe('matchFileType', () => {
  it('should return true if file type is exactly matched', () => {
    expect(matchFileType('image/jpeg', ['image/jpeg'])).to.be.true;
  });
  it('should return true if file type is wildcard matched', () => {
    expect(matchFileType('image/jpeg', ['image/*'])).to.be.true;
  });
  it('should return false if file type is not matched', () => {
    expect(matchFileType('text/plain', ['image/*'])).to.be.false;
  });
});

describe('fileIsImage', () => {
  it('should return true if file is image', () => {
    const file = new File([''], 'name', { type: 'image/jpeg' });
    expect(fileIsImage(file)).to.be.true;
  });
  it('should return false if file is not image', () => {
    const file = new File([''], 'name', { type: 'text/plain' });
    expect(fileIsImage(file)).to.be.false;
  });
});
