import { describe, expect, it } from 'vitest';
import {
  createCdnUrl,
  createCdnUrlModifiers,
  createOriginalUrl,
  extractCdnUrlModifiers,
  extractFilename,
  extractOperations,
  extractUuid,
  joinCdnOperations,
  normalizeCdnOperation,
  trimFilename,
} from './cdn-utils';

const falsyValues = ['', undefined, null, false, true, 0, 10];

describe('cdn-utils/normalizeCdnOperation', () => {
  it('should remove trailing and leading delimeters', () => {
    expect(normalizeCdnOperation('scale_crop/1x1/center')).toBe('scale_crop/1x1/center');
    expect(normalizeCdnOperation('/scale_crop/1x1/center/')).toBe('scale_crop/1x1/center');
    expect(normalizeCdnOperation('-/scale_crop/1x1/center/')).toBe('scale_crop/1x1/center');
  });

  it('should return empty string if falsy value is passed', () => {
    for (const val of falsyValues) {
      expect(normalizeCdnOperation(val)).toBe('');
    }
  });
});

describe('cdn-utils/joinCdnOperations', () => {
  it('should remove trailing and leading delimeters', () => {
    expect(joinCdnOperations('scale_crop/1x1/center', 'resize')).toBe('scale_crop/1x1/center/-/resize');
    expect(joinCdnOperations('/scale_crop/1x1/center/', '/resize/')).toBe('scale_crop/1x1/center/-/resize');
    expect(joinCdnOperations('-/scale_crop/1x1/center/', '-/resize/')).toBe('scale_crop/1x1/center/-/resize');
    expect(joinCdnOperations('-/scale_crop/1x1/center/', '-/resize/100x/')).toBe('scale_crop/1x1/center/-/resize/100x');
  });

  it('should return empty string if falsy values are passed', () => {
    expect(joinCdnOperations(...falsyValues)).toBe('');
    expect(joinCdnOperations('scale_crop/1x1/center', ...falsyValues, 'resize/100x')).toBe(
      'scale_crop/1x1/center/-/resize/100x',
    );
  });
});

describe('cdn-utils/createCdnUrlModifiers', () => {
  it('should make cdn operations string that could be concatendated with domain', () => {
    expect(createCdnUrlModifiers('scale_crop/1x1/center', 'resize')).toBe('-/scale_crop/1x1/center/-/resize/');
  });

  it('should add trailing/leading slash and leading delimeter', () => {
    expect(createCdnUrlModifiers('scale_crop/1x1/center', 'resize')).toBe('-/scale_crop/1x1/center/-/resize/');
    expect(createCdnUrlModifiers('/scale_crop/1x1/center/', '/resize/')).toBe('-/scale_crop/1x1/center/-/resize/');
    expect(createCdnUrlModifiers('-/scale_crop/1x1/center/', '-/resize/')).toBe('-/scale_crop/1x1/center/-/resize/');
    expect(createCdnUrlModifiers('-/scale_crop/1x1/center/', '-/resize/100x/')).toBe(
      '-/scale_crop/1x1/center/-/resize/100x/',
    );
  });

  it('return empty string if nothing is passed', () => {
    expect(createCdnUrlModifiers(...falsyValues)).toBe('');
    expect(createCdnUrlModifiers('scale_crop/1x1/center', ...falsyValues, 'resize')).toBe(
      '-/scale_crop/1x1/center/-/resize/',
    );
  });
});

describe('cdn-utils/createCdnUrl', () => {
  it('should concatenate baseCdnUrl with cdnModifiers', () => {
    expect(createCdnUrl('https://ucarecdn.com/:uuid/', '-/scale_crop/1x1/center/')).toBe(
      'https://ucarecdn.com/:uuid/-/scale_crop/1x1/center/',
    );
  });

  it('should accept filename passed as argument', () => {
    expect(createCdnUrl('https://ucarecdn.com/', '-/scale_crop/1x1/center/', 'image.jpeg')).toBe(
      'https://ucarecdn.com/-/scale_crop/1x1/center/image.jpeg',
    );
    expect(
      createCdnUrl('https://domain.ucr.io:8080/', '-/scale_crop/1x1/center/', 'https://domain.com/image.jpg?q=1#hash'),
    ).toBe('https://domain.ucr.io:8080/-/scale_crop/1x1/center/https://domain.com/image.jpg?q=1#hash');
  });

  it('should extract filename from baseCdnUrl and append it to the result', () => {
    expect(createCdnUrl('https://ucarecdn.com/:uuid/image.jpeg', '-/scale_crop/1x1/center/')).toBe(
      'https://ucarecdn.com/:uuid/-/scale_crop/1x1/center/image.jpeg',
    );
    expect(
      createCdnUrl('https://domain.ucr.io:8080/https://domain.com/image.jpg?q=1#hash', '-/scale_crop/1x1/center/'),
    ).toBe('https://domain.ucr.io:8080/-/scale_crop/1x1/center/https://domain.com/image.jpg?q=1#hash');
  });

  it('should override filename from baseCdnUrl with provided', () => {
    expect(createCdnUrl('https://ucarecdn.com/:uuid/image.jpeg', '-/scale_crop/1x1/center/', 'override.jpeg')).toBe(
      'https://ucarecdn.com/:uuid/-/scale_crop/1x1/center/override.jpeg',
    );
    expect(
      createCdnUrl(
        'https://domain.ucr.io:8080/https://domain.com/image.jpg?q=1#hash',
        '-/scale_crop/1x1/center/',
        'https://domain.com/override.jpg?q=2',
      ),
    ).toBe('https://domain.ucr.io:8080/-/scale_crop/1x1/center/https://domain.com/override.jpg?q=2');
  });

  it('should keep cdn modifiers in the baseCdnUrl', () => {
    expect(createCdnUrl('https://ucarecdn.com/:uuid/-/resize/10x/', '-/scale_crop/1x1/center/')).toBe(
      'https://ucarecdn.com/:uuid/-/resize/10x/-/scale_crop/1x1/center/',
    );
    expect(
      createCdnUrl(
        'https://domain.ucr.io:8080/-/resize/10x/https://domain.com/image.jpg?q=1#hash',
        '-/scale_crop/1x1/center/',
      ),
    ).toBe('https://domain.ucr.io:8080/-/resize/10x/-/scale_crop/1x1/center/https://domain.com/image.jpg?q=1#hash');
  });

  it('should add missing trailing slash to the base url', () => {
    expect(createCdnUrl('https://ucarecdn.com', '-/scale_crop/1x1/center/')).toBe(
      'https://ucarecdn.com/-/scale_crop/1x1/center/',
    );
  });
});

describe('cdn-utils/createOriginalUrl', () => {
  it('should concatenate cdnBase and uuid', () => {
    expect(createOriginalUrl('https://ucarecdn.com/', ':uuid')).toBe('https://ucarecdn.com/:uuid/');
  });

  it('should trim any pathname from cdnBase', () => {
    expect(createOriginalUrl('https://ucarecdn.com/:old-uuid/-/resize/10x/', ':new-uuid')).toBe(
      'https://ucarecdn.com/:new-uuid/',
    );
  });

  it('should add trailing slash to the base url', () => {
    expect(createOriginalUrl('https://ucarecdn.com', ':uuid')).toBe('https://ucarecdn.com/:uuid/');
  });
});

describe('cdn-utils/extractFilename', () => {
  it('should extract filename or file url', () => {
    expect(extractFilename('https://ucarecdn.com/:uuid/image.jpeg')).toBe('image.jpeg');
    expect(extractFilename('https://ucarecdn.com/:uuid/-/resize/100x/image.jpeg')).toBe('image.jpeg');

    expect(extractFilename('https://domain.ucr.io:8080/https://domain.com/image.jpg?q=1#hash')).toBe(
      'https://domain.com/image.jpg?q=1#hash',
    );
    expect(extractFilename('https://domain.ucr.io:8080/-/resize/100x/https://domain.com/image.jpg?q=1#hash')).toBe(
      'https://domain.com/image.jpg?q=1#hash',
    );
  });

  it('should return empty string if no filename found', () => {
    expect(extractFilename('https://ucarecdn.com')).toBe('');
    expect(extractFilename('https://ucarecdn.com/')).toBe('');
    expect(extractFilename('https://ucarecdn.com/:uuid/')).toBe('');
    expect(extractFilename('https://ucarecdn.com/:uuid/-/resize/100x/')).toBe('');
  });
});

describe('cdn-utils/trimFilename', () => {
  it('should trim filename or file url', () => {
    expect(trimFilename('https://ucarecdn.com/:uuid/image.jpeg')).toBe('https://ucarecdn.com/:uuid/');
    expect(trimFilename('https://ucarecdn.com/:uuid/-/resize/100x/image.jpeg')).toBe(
      'https://ucarecdn.com/:uuid/-/resize/100x/',
    );

    expect(trimFilename('https://domain.ucr.io:8080/https://domain.com/image.jpg?q=1#hash')).toBe(
      'https://domain.ucr.io:8080/',
    );
    expect(trimFilename('https://domain.ucr.io:8080/-/resize/https://domain.com/image.jpg?q=1#hash')).toBe(
      'https://domain.ucr.io:8080/-/resize/',
    );
  });

  it('should return original string if no filename found', () => {
    expect(trimFilename('https://ucarecdn.com')).toBe('https://ucarecdn.com/');
    expect(trimFilename('https://ucarecdn.com/')).toBe('https://ucarecdn.com/');
    expect(trimFilename('https://ucarecdn.com/:uuid/')).toBe('https://ucarecdn.com/:uuid/');
    expect(trimFilename('https://ucarecdn.com/:uuid/-/resize/100x/')).toBe('https://ucarecdn.com/:uuid/-/resize/100x/');
  });
});

describe('cdn-utils/extractUuid', () => {
  it('should extract uuid from cdn url', () => {
    expect(extractUuid('https://ucarecdn.com/:uuid/image.jpeg')).toBe(':uuid');
    expect(extractUuid('https://ucarecdn.com/:uuid/-/resize/100x/image.jpeg')).toBe(':uuid');

    expect(extractUuid('https://ucarecdn.com/c2499162-eb07-4b93-b31e-94a89a47e858/image.jpeg')).toBe(
      'c2499162-eb07-4b93-b31e-94a89a47e858',
    );
    expect(extractUuid('https://ucarecdn.com/c2499162-eb07-4b93-b31e-94a89a47e858/-/resize/100x/image.jpeg')).toBe(
      'c2499162-eb07-4b93-b31e-94a89a47e858',
    );
  });
});

describe('cdn-utils/extractOperations', () => {
  it('should extract operations from cdn url', () => {
    expect(extractOperations('https://ucarecdn.com/:uuid/image.jpeg')).toEqual([]);
    expect(
      extractOperations('https://ucarecdn.com/c2499162-eb07-4b93-b31e-94a89a47e858/-/resize/100x/image.jpeg'),
    ).toEqual(['resize/100x']);
    expect(extractOperations('https://domain.ucr.io:8080/-/resize/100x/https://domain.com/image.jpg?q=1#hash')).toEqual(
      ['resize/100x'],
    );
  });
});

describe('cdn-utils/extractCdnUrlModifiers', () => {
  it('should extract operations string from cdn url', () => {
    expect(extractCdnUrlModifiers('https://ucarecdn.com/:uuid/')).toBe('');
    expect(extractCdnUrlModifiers('https://ucarecdn.com/:uuid/image.jpeg')).toBe('');
    expect(
      extractCdnUrlModifiers('https://ucarecdn.com/c2499162-eb07-4b93-b31e-94a89a47e858/-/resize/100x/image.jpeg'),
    ).toBe('-/resize/100x/');
    expect(
      extractCdnUrlModifiers('https://domain.ucr.io:8080/-/resize/100x/https://domain.com/image.jpg?q=1#hash'),
    ).toBe('-/resize/100x/');
  });
});
