import type { ConfigType } from '../types';
import { modifiersFromOperations, parseCdnUrl } from '../utils/cdn';
import { applyTemplateData } from '../utils/template-utils';
import { logger } from './logger';

const log = logger.scope('secure-delivery-proxy');

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
    log.warn(
      'Both secureDeliveryProxy and secureDeliveryProxyUrlResolver are set. The secureDeliveryProxyUrlResolver will be used.',
    );
  }
  if (config.secureDeliveryProxyUrlResolver) {
    try {
      // One parse for all three fields; this used to parse the same URL three
      // times, once per extractor.
      const parsed = parseCdnUrl(url);
      const uuid = parsed.kind === 'file' ? parsed.uuid : parsed.kind === 'proxy' ? '' : parsed.group.uuid;
      const operations = parsed.kind === 'group' ? [] : parsed.operations;
      const fileName =
        parsed.kind === 'proxy' ? parsed.sourceUrl : parsed.kind === 'group' ? '' : (parsed.filename ?? '');

      return await config.secureDeliveryProxyUrlResolver(url, {
        uuid,
        cdnUrlModifiers: modifiersFromOperations(operations),
        fileName,
      });
    } catch (err) {
      log.error('Failed to resolve secure delivery proxy URL. Falling back to the default URL.', err);
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
