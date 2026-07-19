import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { resolveSecureDeliveryProxyUrl, type SecureDeliveryProxyConfig } from './secureDeliveryProxyUrl';

const cdnUrl = 'https://ucarecdn.com/uuid-1234/-/crop/100x100/100,100/-/preview/300x300/photo.jpg';

describe('resolveSecureDeliveryProxyUrl', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let onResolverError: Mock<(error: unknown, context: string) => void>;

  beforeEach(() => {
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
      '[uc]',
      'Both secureDeliveryProxy and secureDeliveryProxyUrlResolver are set. The secureDeliveryProxyUrlResolver will be used.',
    );
    expect(result).toBe('https://resolved.example.com/photo.jpg');
  });

  it('calls the resolver with uuid, cdnUrlModifiers, and fileName extracted from the url', async () => {
    const resolver = vi.fn().mockResolvedValue('https://resolved.example.com/photo.jpg');
    const config: SecureDeliveryProxyConfig = {
      secureDeliveryProxy: '',
      secureDeliveryProxyUrlResolver: resolver,
    };

    await resolveSecureDeliveryProxyUrl(config, onResolverError, cdnUrl);

    expect(resolver).toHaveBeenCalledExactlyOnceWith(cdnUrl, {
      uuid: 'uuid-1234',
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
      '[uc]',
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
});
