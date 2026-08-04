import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTopLevelOrigin } from './get-top-level-origin';

describe('getTopLevelOrigin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return the top-level origin', () => {
    const origin = getTopLevelOrigin();
    expect(origin).toBe(window.location.origin);
  });

  it('should return the last ancestor origin when framed', () => {
    vi.stubGlobal('location', {
      origin: 'https://self.example',
      ancestorOrigins: ['https://parent.example', 'https://top.example'],
    });
    expect(getTopLevelOrigin()).toBe('https://top.example');
  });

  it('should fall back when ancestorOrigins is empty', () => {
    vi.stubGlobal('location', {
      origin: 'https://self.example',
      ancestorOrigins: [],
    });
    expect(getTopLevelOrigin()).toBe('https://self.example');
  });

  it('should fall back when ancestorOrigins is not supported', () => {
    vi.stubGlobal('location', {
      origin: 'https://self.example',
      ancestorOrigins: undefined,
    });
    expect(getTopLevelOrigin()).toBe('https://self.example');
  });

  it('should fall back when the top-level origin is opaque', () => {
    vi.stubGlobal('location', {
      origin: 'https://self.example',
      ancestorOrigins: ['https://parent.example', 'null'],
    });
    expect(getTopLevelOrigin()).toBe('https://self.example');
  });
});
