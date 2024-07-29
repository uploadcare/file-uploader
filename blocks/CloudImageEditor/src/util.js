import { PACKAGE_NAME, PACKAGE_VERSION } from '../../../env.js';
import { createCdnUrl, createCdnUrlModifiers } from '../../../utils/cdn-utils.js';
import { COMMON_OPERATIONS, transformationsToOperations } from './lib/transformationUtils.js';

export function viewerImageSrc(originalUrl, width, transformations) {
  const MAX_CDN_DIMENSION = 3000;
  let dpr = window.devicePixelRatio;
  let size = Math.min(Math.ceil(width * dpr), MAX_CDN_DIMENSION);
  let quality = dpr >= 2 ? 'lightest' : 'normal';

  return createCdnUrl(
    originalUrl,
    createCdnUrlModifiers(
      COMMON_OPERATIONS,
      transformationsToOperations(transformations),
      `quality/${quality}`,
      `stretch/off/-/resize/${size}x`,
      `@clib/${PACKAGE_NAME}/${PACKAGE_VERSION}/uc-cloud-image-editor/`,
    ),
  );
}
