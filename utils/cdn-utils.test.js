import { expect } from '@esm-bundle/chai';
import {
  normalizeCdnOperation,
  joinCdnOperations,
  createCdnUrlModifiers,
  createCdnUrl,
  createOriginalUrl,
} from './cdn-utils.js';

const falsyValues = ['', undefined, null, false, true, 0, 10];

describe('cdn-utils', () => {
  describe('cdnOperation', () => {
    it('should remove trailing and leading delimeters', () => {
      expect(normalizeCdnOperation('scale_crop/1x1/center')).to.eq('scale_crop/1x1/center');
      expect(normalizeCdnOperation('/scale_crop/1x1/center/')).to.eq('scale_crop/1x1/center');
      expect(normalizeCdnOperation('-/scale_crop/1x1/center/')).to.eq('scale_crop/1x1/center');
    });

    it('should return empty string if falsy value is passed', () => {
      for (let val of falsyValues) {
        expect(normalizeCdnOperation(val)).to.eq('');
      }
    });
  });
  describe('joinCdnOperations', () => {
    it('should remove trailing and leading delimeters', () => {
      expect(joinCdnOperations('scale_crop/1x1/center', 'resize')).to.eq('scale_crop/1x1/center/-/resize');
      expect(joinCdnOperations('/scale_crop/1x1/center/', '/resize/')).to.eq('scale_crop/1x1/center/-/resize');
      expect(joinCdnOperations('-/scale_crop/1x1/center/', '-/resize/')).to.eq('scale_crop/1x1/center/-/resize');
      expect(joinCdnOperations('-/scale_crop/1x1/center/', '-/resize/100x/')).to.eq(
        'scale_crop/1x1/center/-/resize/100x'
      );
    });

    it('should return empty string if falsy values are passed', () => {
      expect(joinCdnOperations(...falsyValues)).to.eq('');
      expect(joinCdnOperations('scale_crop/1x1/center', ...falsyValues, 'resize/100x')).to.eq(
        'scale_crop/1x1/center/-/resize/100x'
      );
    });
  });

  describe('createCdnUrlModifiers', () => {
    it('should make cdn operations string that could be concatendated with domain', () => {
      expect(createCdnUrlModifiers('scale_crop/1x1/center', 'resize')).to.eq('-/scale_crop/1x1/center/-/resize/');
    });

    it('should add trailing/leading slash and leading delimeter', () => {
      expect(createCdnUrlModifiers('scale_crop/1x1/center', 'resize')).to.eq('-/scale_crop/1x1/center/-/resize/');
      expect(createCdnUrlModifiers('/scale_crop/1x1/center/', '/resize/')).to.eq('-/scale_crop/1x1/center/-/resize/');
      expect(createCdnUrlModifiers('-/scale_crop/1x1/center/', '-/resize/')).to.eq('-/scale_crop/1x1/center/-/resize/');
      expect(createCdnUrlModifiers('-/scale_crop/1x1/center/', '-/resize/100x/')).to.eq(
        '-/scale_crop/1x1/center/-/resize/100x/'
      );
    });

    it('return empty string if nothing is passed', () => {
      expect(createCdnUrlModifiers(...falsyValues)).to.eq('');
      expect(createCdnUrlModifiers('scale_crop/1x1/center', ...falsyValues, 'resize')).to.eq(
        '-/scale_crop/1x1/center/-/resize/'
      );
    });
  });

  describe('createCdnUrl', () => {
    it('should concatenate domain with cdnModifiers', () => {
      expect(createCdnUrl('https://ucarecdn.com/', '-/scale_crop/1x1/center/')).to.eq(
        'https://ucarecdn.com/-/scale_crop/1x1/center/'
      );
    });

    it('should accept filename', () => {
      expect(createCdnUrl('https://ucarecdn.com/', '-/scale_crop/1x1/center/', 'image.jpeg')).to.eq(
        'https://ucarecdn.com/-/scale_crop/1x1/center/image.jpeg'
      );
    });

    it('should add missing trailing slash to the base url', () => {
      expect(createCdnUrl('https://ucarecdn.com', '-/scale_crop/1x1/center/')).to.eq(
        'https://ucarecdn.com/-/scale_crop/1x1/center/'
      );
    });
  });

  describe('createOriginalUrl', () => {
    it('should concatenate cdnBase and uuid', () => {
      expect(createOriginalUrl('https://ucarecdn.com/', 'e02aa8f3-9d28-4109-8c8c-310ef0f060ac')).to.eq(
        'https://ucarecdn.com/e02aa8f3-9d28-4109-8c8c-310ef0f060ac/'
      );
    });

    it('should add trailing slash to the base url', () => {
      expect(createOriginalUrl('https://ucarecdn.com', 'e02aa8f3-9d28-4109-8c8c-310ef0f060ac')).to.eq(
        'https://ucarecdn.com/e02aa8f3-9d28-4109-8c8c-310ef0f060ac/'
      );
    });
  });
});
