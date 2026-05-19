import { PACKAGE_NAME, PACKAGE_VERSION } from '../../../env';
import { createCdnUrl, createCdnUrlModifiers } from '../../../utils/cdn-utils';
import { COMMON_OPERATIONS, transformationsToOperations } from './lib/transformationUtils';
import type { Transformations } from './types';

export function viewerImageSrc(originalUrl: string, width: number, transformations: Transformations): string {
  const MAX_CDN_DIMENSION = 3000;
  const dpr = window.devicePixelRatio;
  const size = Math.min(Math.ceil(width * dpr), MAX_CDN_DIMENSION);
  const quality = dpr >= 2 ? 'lightest' : 'normal';

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
