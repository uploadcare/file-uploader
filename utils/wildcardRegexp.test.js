import { expect } from '@esm-bundle/chai';
import { wildcardRegexp } from './wildcardRegexp';

describe('wildcardRegexp', () => {
  it('should return regexp to match wildcard', () => {
    const regexp = wildcardRegexp('*.jpg');
    expect(regexp).to.be.instanceOf(RegExp);
  });

  it('should work for mime types', () => {
    expect(wildcardRegexp('*.jpg').test('test.jpg')).to.be.true;
    expect(wildcardRegexp('image/*').test('image/jpeg')).to.be.true;
    expect(
      wildcardRegexp('application/vnd.openxmlformats-officedocument.*').test(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
      ),
    ).to.be.true;
  });
});
