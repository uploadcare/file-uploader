import { describe, expect, it } from 'vitest';
import { DEFAULT_CDN_ORIGIN, deliveryProxyOrigin } from './origin';

describe('DEFAULT_CDN_ORIGIN', () => {
  it('is the Uploadcare CDN, with no trailing slash', () => {
    expect(DEFAULT_CDN_ORIGIN).toBe('https://ucarecdn.com');
  });
});

describe('deliveryProxyOrigin', () => {
  it('builds the per-project delivery-proxy origin', () => {
    expect(deliveryProxyOrigin('mypub')).toBe('https://mypub.ucr.io');
  });
});
