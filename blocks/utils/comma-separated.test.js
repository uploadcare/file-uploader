import { expect } from '@esm-bundle/chai';
import { deserealizeCsv, serializeCsv } from './comma-separated.js';

describe('deserealizeCsv', () => {
  it('should convert comma separated string to array', () => {
    expect(deserealizeCsv('a,b,c')).to.deep.equal(['a', 'b', 'c']);
    expect(deserealizeCsv('a')).to.deep.equal(['a']);
    expect(deserealizeCsv()).to.deep.equal([]);
    expect(deserealizeCsv('  a   ,  b   , c  ')).to.deep.equal(['a', 'b', 'c']);
  });
});

describe('serializeCsv', () => {
  it('should convert array to comma separated string', () => {
    expect(serializeCsv(['a', 'b', 'c'])).to.equal('a,b,c');
    expect(serializeCsv(['a'])).to.equal('a');
    expect(serializeCsv()).to.equal('');
  });
});
