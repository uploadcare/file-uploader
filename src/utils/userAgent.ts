import type { CustomUserAgentFn, CustomUserAgentOptions } from '@uploadcare/upload-client';
import { getUserAgent } from '@uploadcare/upload-client';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../env';

export function customUserAgent(options: CustomUserAgentOptions): ReturnType<CustomUserAgentFn> {
  return getUserAgent({
    ...options,
    libraryName: PACKAGE_NAME,
    libraryVersion: PACKAGE_VERSION,
  });
}
