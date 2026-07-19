import type { ConfigType } from '../types';
import { extractCdnUrlModifiers, extractFilename, extractUuid } from '../utils/cdn-utils';
import { applyTemplateData } from '../utils/template-utils';
import { logger } from './logger';

export type SecureDeliveryProxyConfig = Pick<ConfigType, 'secureDeliveryProxy' | 'secureDeliveryProxyUrlResolver'>;

/**
 * Resolve a CDN url through the configured secure-delivery proxy, if any.
 * Extracted verbatim from `LitBlock.proxyUrl` so both the v1 and v2 element
 * bases can delegate to the same DOM-free logic.
 */
export async function resolveSecureDeliveryProxyUrl(
  config: SecureDeliveryProxyConfig,
  onResolverError: (error: unknown, context: string) => void,
  url: string,
): Promise<string> {
  if (config.secureDeliveryProxy && config.secureDeliveryProxyUrlResolver) {
    logger.warn(
      'Both secureDeliveryProxy and secureDeliveryProxyUrlResolver are set. The secureDeliveryProxyUrlResolver will be used.',
    );
  }
  if (config.secureDeliveryProxyUrlResolver) {
    try {
      return await config.secureDeliveryProxyUrlResolver(url, {
        uuid: extractUuid(url),
        cdnUrlModifiers: extractCdnUrlModifiers(url),
        fileName: extractFilename(url),
      });
    } catch (err) {
      logger.error('Failed to resolve secure delivery proxy URL. Falling back to the default URL.', err);
      onResolverError(
        err,
        'secureDeliveryProxyUrlResolver. Failed to resolve secure delivery proxy URL. Falling back to the default URL.',
      );
      return url;
    }
  }
  if (config.secureDeliveryProxy) {
    return applyTemplateData(
      config.secureDeliveryProxy,
      { previewUrl: url },
      { transform: (value) => encodeURIComponent(value) },
    );
  }
  return url;
}
