import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { __resetLoggerForTests } from './logger';
import { resolveSecureDeliveryProxyUrl, type SecureDeliveryProxyConfig } from './secureDeliveryProxyUrl';

const cdnUrl =
  'https://ucarecdn.com/c2499162-eb07-4b93-b31e-94a89a47e858/-/crop/100x100/100,100/-/preview/300x300/photo.jpg';

describe('resolveSecureDeliveryProxyUrl', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let onResolverError: Mock<(error: unknown, context: string) => void>;

  beforeEach(() => {
    __resetLoggerForTests();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    onResolverError = vi.fn<(error: unknown, context: string) => void>();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('uses the resolver when only it is set, and passes it through unaltered', async () => {
    const resolver = vi.fn().mockResolvedValue('https://resolved.example.com/photo.jpg');
    const config: SecureDeliveryProxyConfig = {
      secureDeliveryProxy: '',
      secureDeliveryProxyUrlResolver: resolver,
    };

    const result = await resolveSecureDeliveryProxyUrl(config, onResolverError, cdnUrl);

    expect(result).toBe('https://resolved.example.com/photo.jpg');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(onResolverError).not.toHaveBeenCalled();
  });

  it('warns when both secureDeliveryProxy and secureDeliveryProxyUrlResolver are set, then uses the resolver', async () => {
    const resolver = vi.fn().mockResolvedValue('https://resolved.example.com/photo.jpg');
    const config: SecureDeliveryProxyConfig = {
      secureDeliveryProxy: 'https://proxy.example.com/{{previewUrl}}',
      secureDeliveryProxyUrlResolver: resolver,
    };

    const result = await resolveSecureDeliveryProxyUrl(config, onResolverError, cdnUrl);

    expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
      '[uc][secure-delivery-proxy]',
      'Both secureDeliveryProxy and secureDeliveryProxyUrlResolver are set. The secureDeliveryProxyUrlResolver will be used.',
    );
    expect(result).toBe('https://resolved.example.com/photo.jpg');
  });

  it('warns about both being set once, not once per url', async () => {
    const config: SecureDeliveryProxyConfig = {
      secureDeliveryProxy: 'https://proxy.example.com/{{previewUrl}}',
      secureDeliveryProxyUrlResolver: vi.fn().mockResolvedValue('https://resolved.example.com/photo.jpg'),
    };

    await resolveSecureDeliveryProxyUrl(config, onResolverError, cdnUrl);
    await resolveSecureDeliveryProxyUrl(config, onResolverError, cdnUrl);

    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('calls the resolver with uuid, cdnUrlModifiers, and fileName extracted from the url', async () => {
    const resolver = vi.fn().mockResolvedValue('https://resolved.example.com/photo.jpg');
    const config: SecureDeliveryProxyConfig = {
      secureDeliveryProxy: '',
      secureDeliveryProxyUrlResolver: resolver,
    };

    await resolveSecureDeliveryProxyUrl(config, onResolverError, cdnUrl);

    expect(resolver).toHaveBeenCalledExactlyOnceWith(cdnUrl, {
      uuid: 'c2499162-eb07-4b93-b31e-94a89a47e858',
      cdnUrlModifiers: '-/crop/100x100/100,100/-/preview/300x300/',
      fileName: 'photo.jpg',
    });
  });

  it('on resolver throw: logs console.error, invokes onResolverError with the context string, and falls back to the passthrough url', async () => {
    const failure = new Error('network down');
    const resolver = vi.fn().mockRejectedValue(failure);
    const config: SecureDeliveryProxyConfig = {
      secureDeliveryProxy: '',
      secureDeliveryProxyUrlResolver: resolver,
    };

    const result = await resolveSecureDeliveryProxyUrl(config, onResolverError, cdnUrl);

    expect(result).toBe(cdnUrl);
    expect(errorSpy).toHaveBeenCalledExactlyOnceWith(
      '[uc][secure-delivery-proxy]',
      'Failed to resolve secure delivery proxy URL. Falling back to the default URL.',
      failure,
    );
    expect(onResolverError).toHaveBeenCalledExactlyOnceWith(
      failure,
      'secureDeliveryProxyUrlResolver. Failed to resolve secure delivery proxy URL. Falling back to the default URL.',
    );
  });

  it('applies the secureDeliveryProxy template with an encoded previewUrl when no resolver is set', async () => {
    const config: SecureDeliveryProxyConfig = {
      secureDeliveryProxy: 'https://proxy.example.com/?url={{previewUrl}}',
      secureDeliveryProxyUrlResolver: null,
    };

    const result = await resolveSecureDeliveryProxyUrl(config, onResolverError, cdnUrl);

    expect(result).toBe(`https://proxy.example.com/?url=${window.encodeURIComponent(cdnUrl)}`);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns the url unchanged when neither secureDeliveryProxy nor the resolver is set', async () => {
    const config: SecureDeliveryProxyConfig = {
      secureDeliveryProxy: '',
      secureDeliveryProxyUrlResolver: null,
    };

    const result = await resolveSecureDeliveryProxyUrl(config, onResolverError, cdnUrl);

    expect(result).toBe(cdnUrl);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(onResolverError).not.toHaveBeenCalled();
  });

  it('falls back to the unproxied url when the url cannot be parsed', async () => {
    const resolver = vi.fn();

    const result = await resolveSecureDeliveryProxyUrl(
      { secureDeliveryProxy: '', secureDeliveryProxyUrlResolver: resolver },
      () => {},
      'https://cdn.example.com/not-a-cdn-url',
    );

    expect(result).toBe('https://cdn.example.com/not-a-cdn-url');
    expect(resolver).not.toHaveBeenCalled();
  });
  describe('Security: Invalid inputs and edge cases', () => {
    it('handles URLs with special characters in filename (spaces, %, #)', async () => {
      const urlWithSpecialChars =
        'https://ucarecdn.com/c2499162-eb07-4b93-b31e-94a89a47e858/-/preview/300x300/my%20photo%20(1).jpg';
      const resolver = vi.fn().mockResolvedValue('https://resolved.example.com/file');
      const config: SecureDeliveryProxyConfig = {
        secureDeliveryProxy: '',
        secureDeliveryProxyUrlResolver: resolver,
      };

      await resolveSecureDeliveryProxyUrl(config, onResolverError, urlWithSpecialChars);

      expect(resolver).toHaveBeenCalledOnce();
      const callArgs = resolver.mock.calls[0]![1];
      expect(callArgs!.fileName).toBe('my%20photo%20(1).jpg');
    });

    it('properly encodes special characters in proxy template substitution', async () => {
      const urlWithSpecialChars =
        'https://ucarecdn.com/c2499162-eb07-4b93-b31e-94a89a47e858/-/preview/300x300/photo%20with%20spaces.jpg';
      const config: SecureDeliveryProxyConfig = {
        secureDeliveryProxy: 'https://proxy.example.com/?secure={{previewUrl}}',
        secureDeliveryProxyUrlResolver: null,
      };

      const result = await resolveSecureDeliveryProxyUrl(config, onResolverError, urlWithSpecialChars);

      // encodeURIComponent encodes the URL once for safe template substitution
      const expectedEncodedUrl = encodeURIComponent(urlWithSpecialChars);
      expect(result).toBe(`https://proxy.example.com/?secure=${expectedEncodedUrl}`);
    });

    it('handles URLs with unicode characters in filename', async () => {
      const unicodeUrl = 'https://ucarecdn.com/c2499162-eb07-4b93-b31e-94a89a47e858/-/preview/300x300/фото.jpg';
      const resolver = vi.fn().mockResolvedValue('https://resolved.example.com/file');
      const config: SecureDeliveryProxyConfig = {
        secureDeliveryProxy: '',
        secureDeliveryProxyUrlResolver: resolver,
      };

      const result = await resolveSecureDeliveryProxyUrl(config, onResolverError, unicodeUrl);

      expect(resolver).toHaveBeenCalledOnce();
      expect(result).toBe('https://resolved.example.com/file');
    });

    it('handles very long URLs without truncation', async () => {
      const longFileName = `${'a'.repeat(500)}.jpg`;
      const longUrl = `https://ucarecdn.com/c2499162-eb07-4b93-b31e-94a89a47e858/-/preview/300x300/${longFileName}`;
      const resolver = vi.fn().mockResolvedValue('https://resolved.example.com/file');
      const config: SecureDeliveryProxyConfig = {
        secureDeliveryProxy: '',
        secureDeliveryProxyUrlResolver: resolver,
      };

      await resolveSecureDeliveryProxyUrl(config, onResolverError, longUrl);

      expect(resolver).toHaveBeenCalledOnce();
      const callArgs = resolver.mock.calls[0]!;
      expect(callArgs![0]).toBe(longUrl);
      expect(callArgs![1]!.fileName).toBe(longFileName);
    });

    it('ignores a fragment when extracting the file details, and hands the resolver the URL as given', async () => {
      const urlWithFragment =
        'https://ucarecdn.com/c2499162-eb07-4b93-b31e-94a89a47e858/-/preview/300x300/photo.jpg#section';
      const resolver = vi.fn().mockResolvedValue('https://resolved.example.com/file');
      const config: SecureDeliveryProxyConfig = {
        secureDeliveryProxy: '',
        secureDeliveryProxyUrlResolver: resolver,
      };

      const result = await resolveSecureDeliveryProxyUrl(config, onResolverError, urlWithFragment);

      expect(result).toBe('https://resolved.example.com/file');
      expect(resolver).toHaveBeenCalledExactlyOnceWith(urlWithFragment, {
        uuid: 'c2499162-eb07-4b93-b31e-94a89a47e858',
        cdnUrlModifiers: '-/preview/300x300/',
        fileName: 'photo.jpg',
      });
      expect(onResolverError).not.toHaveBeenCalled();
    });

    it('rejects or handles null URL input safely', async () => {
      const resolver = vi.fn().mockResolvedValue('https://resolved.example.com/file');
      const config: SecureDeliveryProxyConfig = {
        secureDeliveryProxy: '',
        secureDeliveryProxyUrlResolver: resolver,
      };

      // Pass null as url (type assertion to bypass TS)
      const nullUrl = null as unknown as string;

      // Unparseable: the resolver is skipped, the failure is reported, and the input comes back unchanged.
      const result = await resolveSecureDeliveryProxyUrl(config, onResolverError, nullUrl);

      expect(result).toBeNull();
      expect(resolver).not.toHaveBeenCalled();
      expect(onResolverError).toHaveBeenCalledOnce();
    });

    it('rejects or handles empty string URL safely', async () => {
      const resolver = vi.fn().mockResolvedValue('https://resolved.example.com/file');
      const config: SecureDeliveryProxyConfig = {
        secureDeliveryProxy: '',
        secureDeliveryProxyUrlResolver: resolver,
      };

      const result = await resolveSecureDeliveryProxyUrl(config, onResolverError, '');

      // Empty string should not parse as valid CDN URL, fallback expected
      expect(result).toBe('');
      expect(resolver).not.toHaveBeenCalled();
    });

    it('handles URLs with query parameters', async () => {
      const urlWithParams =
        'https://ucarecdn.com/c2499162-eb07-4b93-b31e-94a89a47e858/-/preview/300x300/photo.jpg?param=value&other=123';
      const resolver = vi.fn().mockResolvedValue('https://resolved.example.com/file');
      const config: SecureDeliveryProxyConfig = {
        secureDeliveryProxy: '',
        secureDeliveryProxyUrlResolver: resolver,
      };

      const result = await resolveSecureDeliveryProxyUrl(config, onResolverError, urlWithParams);

      // The query string is not part of the file details; the resolver still gets the URL as given.
      expect(result).toBe('https://resolved.example.com/file');
      expect(resolver).toHaveBeenCalledExactlyOnceWith(urlWithParams, {
        uuid: 'c2499162-eb07-4b93-b31e-94a89a47e858',
        cdnUrlModifiers: '-/preview/300x300/',
        fileName: 'photo.jpg',
      });
      expect(onResolverError).not.toHaveBeenCalled();
    });

    it('resolver receives correctly extracted modifiers from complex URLs', async () => {
      const complexUrl =
        'https://ucarecdn.com/12345678-1234-1234-1234-123456789012/-/quality/best/-/format/auto/-/progressive/yes/-/preview/500x500/complex-image.png';
      const resolver = vi.fn().mockResolvedValue('https://resolved.example.com/file');
      const config: SecureDeliveryProxyConfig = {
        secureDeliveryProxy: '',
        secureDeliveryProxyUrlResolver: resolver,
      };

      await resolveSecureDeliveryProxyUrl(config, onResolverError, complexUrl);

      expect(resolver).toHaveBeenCalledExactlyOnceWith(complexUrl, {
        uuid: '12345678-1234-1234-1234-123456789012',
        cdnUrlModifiers: '-/quality/best/-/format/auto/-/progressive/yes/-/preview/500x500/',
        fileName: 'complex-image.png',
      });
    });

    it('proxy template expansion handles URL-like values safely', async () => {
      const config: SecureDeliveryProxyConfig = {
        secureDeliveryProxy: 'https://proxy.example.com/secure?file={{previewUrl}}&sig=abc123',
        secureDeliveryProxyUrlResolver: null,
      };

      const result = await resolveSecureDeliveryProxyUrl(config, onResolverError, cdnUrl);

      // Result must be a valid URL
      expect(() => new URL(result)).not.toThrow();
      // Signature must be preserved as-is
      expect(result).toContain('sig=abc123');
      // Original URL must be encoded
      expect(result).toContain('proxy.example.com');
    });
  });
});
