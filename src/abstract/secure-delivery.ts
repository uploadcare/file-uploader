import type { ConfigController } from '../abstract/controllers/ConfigController';
import { extractCdnUrlModifiers, extractFilename, extractUuid } from '../utils/cdn-utils';
import { applyTemplateData } from '../utils/template-utils';

type SecureDeliveryCfg = {
  secureDeliveryProxy?: string;
  secureDeliveryProxyUrlResolver?: (
    url: string,
    info: { uuid: string; cdnUrlModifiers: string; fileName: string },
  ) => Promise<string> | string;
};

/**
 * Resolves a CDN preview URL through an optional secure-delivery proxy.
 * Honors the same config keys as v1: `secureDeliveryProxyUrlResolver` (async
 * function) takes precedence over `secureDeliveryProxy` (URL template with
 * `{{previewUrl}}` placeholder). Falls back to the original URL when neither
 * is configured or the resolver throws.
 *
 * Pure utility — no DOM, no Lit. Mirrors v1's `LitBlock.proxyUrl()`.
 */
export async function proxyDeliveryUrl(url: string, config: ConfigController): Promise<string> {
  const cfg = config.values as SecureDeliveryCfg;
  if (cfg.secureDeliveryProxy && cfg.secureDeliveryProxyUrlResolver) {
    console.warn(
      '[uploadcare] Both `secureDeliveryProxy` and `secureDeliveryProxyUrlResolver` are set. The resolver takes precedence.',
    );
  }
  if (cfg.secureDeliveryProxyUrlResolver) {
    try {
      return await cfg.secureDeliveryProxyUrlResolver(url, {
        uuid: extractUuid(url),
        cdnUrlModifiers: extractCdnUrlModifiers(url),
        fileName: extractFilename(url),
      });
    } catch (err) {
      console.error('[uploadcare] `secureDeliveryProxyUrlResolver` threw; falling back to the original URL.', err);
      return url;
    }
  }
  if (cfg.secureDeliveryProxy) {
    return applyTemplateData(
      cfg.secureDeliveryProxy,
      { previewUrl: url },
      { transform: (value) => window.encodeURIComponent(value) },
    );
  }
  return url;
}
