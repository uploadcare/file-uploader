import { expect } from '@esm-bundle/chai';
import {
  normalizeCdnOperation,
  joinCdnOperations,
  createCdnUrlModifiers,
  createCdnUrl,
  createOriginalUrl,
  extractFilename,
  trimFilename,
} from './cdn-utils.js';

const falsyValues = ['', undefined, null, false, true, 0, 10];

describe('cdn-utils/normalizeCdnOperation', () => {
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

describe('cdn-utils/joinCdnOperations', () => {
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

describe('cdn-utils/createCdnUrlModifiers', () => {
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

describe('cdn-utils/createCdnUrl', () => {
  it('should concatenate baseCdnUrl with cdnModifiers', () => {
    expect(createCdnUrl('https://ucarecdn.com/:uuid/', '-/scale_crop/1x1/center/')).to.eq(
      'https://ucarecdn.com/:uuid/-/scale_crop/1x1/center/'
    );
  });

  it('should accept filename passed as argument', () => {
    expect(createCdnUrl('https://ucarecdn.com/', '-/scale_crop/1x1/center/', 'image.jpeg')).to.eq(
      'https://ucarecdn.com/-/scale_crop/1x1/center/image.jpeg'
    );
    expect(
      createCdnUrl('https://domain.ucr.io/', '-/scale_crop/1x1/center/', 'https://domain.com/image.jpg?q=1')
    ).to.eq('https://domain.ucr.io/-/scale_crop/1x1/center/https://domain.com/image.jpg%3Fq=1');
  });

  it('should extract filename from baseCdnUrl and append it to the result', () => {
    expect(createCdnUrl('https://ucarecdn.com/:uuid/image.jpeg', '-/scale_crop/1x1/center/')).to.eq(
      'https://ucarecdn.com/:uuid/-/scale_crop/1x1/center/image.jpeg'
    );
    expect(createCdnUrl('https://domain.ucr.io/https://domain.com/image.jpg?q=1', '-/scale_crop/1x1/center/')).to.eq(
      'https://domain.ucr.io/-/scale_crop/1x1/center/https://domain.com/image.jpg%3Fq=1'
    );
  });

  it('should override filename from baseCdnUrl with provided', () => {
    expect(createCdnUrl('https://ucarecdn.com/:uuid/image.jpeg', '-/scale_crop/1x1/center/', 'override.jpeg')).to.eq(
      'https://ucarecdn.com/:uuid/-/scale_crop/1x1/center/override.jpeg'
    );
    expect(
      createCdnUrl(
        'https://domain.ucr.io/https://domain.com/image.jpg?q=1',
        '-/scale_crop/1x1/center/',
        'https://domain.com/override.jpg'
      )
    ).to.eq('https://domain.ucr.io/-/scale_crop/1x1/center/https://domain.com/override.jpg');
  });

  it('should keep cdn modifiers in the baseCdnUrl', () => {
    expect(createCdnUrl('https://ucarecdn.com/:uuid/-/resize/10x/', '-/scale_crop/1x1/center/')).to.eq(
      'https://ucarecdn.com/:uuid/-/resize/10x/-/scale_crop/1x1/center/'
    );
    expect(
      createCdnUrl('https://domain.ucr.io/-/resize/10x/https://domain.com/image.jpg?q=1', '-/scale_crop/1x1/center/')
    ).to.eq('https://domain.ucr.io/-/resize/10x/-/scale_crop/1x1/center/https://domain.com/image.jpg%3Fq=1');
  });

  it('should add missing trailing slash to the base url', () => {
    expect(createCdnUrl('https://ucarecdn.com', '-/scale_crop/1x1/center/')).to.eq(
      'https://ucarecdn.com/-/scale_crop/1x1/center/'
    );
  });
});

describe('cdn-utils/createOriginalUrl', () => {
  it('should concatenate cdnBase and uuid/file url', () => {
    expect(createOriginalUrl('https://ucarecdn.com/', ':uuid')).to.eq('https://ucarecdn.com/:uuid/');
    expect(createOriginalUrl('https://domain.ucr.io/', 'https://domain.com/image.jpg?q=1')).to.eq(
      'https://domain.ucr.io/https://domain.com/image.jpg%3Fq=1'
    );
  });

  it('should trim any pathname from cdnBase', () => {
    expect(createOriginalUrl('https://ucarecdn.com/:old-uuid/-/resize/10x/', ':new-uuid')).to.eq(
      'https://ucarecdn.com/:new-uuid/'
    );
    expect(createOriginalUrl('https://domain.ucr.io/-/resize/10x/', 'https://domain.com/image.jpg?q=1')).to.eq(
      'https://domain.ucr.io/https://domain.com/image.jpg%3Fq=1'
    );
  });

  it('should add trailing slash to the base url', () => {
    expect(createOriginalUrl('https://ucarecdn.com', ':uuid')).to.eq('https://ucarecdn.com/:uuid/');
    expect(createOriginalUrl('https://domain.ucr.io', 'https://domain.com/image.jpg?q=1')).to.eq(
      'https://domain.ucr.io/https://domain.com/image.jpg%3Fq=1'
    );
  });
});

describe('cdn-utils/extractFilename', () => {
  it('should extract filename or file url', () => {
    expect(extractFilename('https://ucarecdn.com/:uuid/image.jpeg')).to.eq('image.jpeg');
    expect(extractFilename('https://ucarecdn.com/:uuid/-/resize/100x/image.jpeg')).to.eq('image.jpeg');

    expect(extractFilename('https://domain.ucr.io/https://domain.com/image.jpg?q=1')).to.eq(
      'https://domain.com/image.jpg?q=1'
    );
    expect(extractFilename('https://domain.ucr.io/-/resize/100x/https://domain.com/image.jpg?q=1')).to.eq(
      'https://domain.com/image.jpg?q=1'
    );
  });

  it('should return empty string if no filename found', () => {
    expect(extractFilename('https://ucarecdn.com')).to.eq('');
    expect(extractFilename('https://ucarecdn.com/')).to.eq('');
    expect(extractFilename('https://ucarecdn.com/:uuid/')).to.eq('');
    expect(extractFilename('https://ucarecdn.com/:uuid/-/resize/100x/')).to.eq('');
  });
});

describe('cdn-utils/trimFilename', () => {
  it('should trim filename or file url', () => {
    expect(trimFilename('https://ucarecdn.com/:uuid/image.jpeg')).to.eq('https://ucarecdn.com/:uuid/');
    expect(trimFilename('https://ucarecdn.com/:uuid/-/resize/100x/image.jpeg')).to.eq(
      'https://ucarecdn.com/:uuid/-/resize/100x/'
    );

    expect(trimFilename('https://domain.ucr.io/https://domain.com/image.jpg?q=1')).to.eq('https://domain.ucr.io/');
    expect(trimFilename('https://domain.ucr.io/-/resize/https://domain.com/image.jpg?q=1')).to.eq(
      'https://domain.ucr.io/-/resize/'
    );
  });

  it('should return original string if no filename found', () => {
    expect(trimFilename('https://ucarecdn.com')).to.eq('https://ucarecdn.com/');
    expect(trimFilename('https://ucarecdn.com/')).to.eq('https://ucarecdn.com/');
    expect(trimFilename('https://ucarecdn.com/:uuid/')).to.eq('https://ucarecdn.com/:uuid/');
    expect(trimFilename('https://ucarecdn.com/:uuid/-/resize/100x/')).to.eq(
      'https://ucarecdn.com/:uuid/-/resize/100x/'
    );
  });
});
