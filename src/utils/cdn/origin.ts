import { defaultProxyEndpoint } from '@uploadcare/cdn-url/proxy';

/**
 * The default CDN origin, without a trailing slash. Single source of truth: it
 * previously existed as three independent literals in `blocks/Config`,
 * `blocks/Img/props-map.ts` and `controllers/CloudImageEditorController.ts`.
 */
export const DEFAULT_CDN_ORIGIN = 'https://ucarecdn.com';

/**
 * Delivery-proxy origin for a public key (`https://<pubkey>.ucr.io`). Note this is
 * a different scheme from the uploader's pubkey-derived cname
 * (`@uploadcare/cname-prefix`, `*.ucarecd.net`), which stays where it is.
 */
export const deliveryProxyOrigin = (publicKey: string): string => defaultProxyEndpoint(publicKey);
