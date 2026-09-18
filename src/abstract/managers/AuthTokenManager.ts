import { AuthTokenCache } from '@uploadcare/signed-uploads/client';
import { SharedInstance } from '../../lit/shared-instances';
import type { AuthToken } from '../../types/index';

/**
 * Owns the one long-lived token cache for this uploader context.
 *
 * `authToken` may be a resolver, and `@uploadcare/upload-client` calls it
 * before every single request — so without a cache a multipart upload would hit
 * the app's token endpoint once per chunk.
 */
export class AuthTokenManager extends SharedInstance {
  private _cache: AuthTokenCache | null = null;

  /** The value to hand `@uploadcare/upload-client` as `authToken`. */
  public getAuthToken(): AuthToken | undefined {
    const { authToken } = this._cfg;

    if (!authToken) {
      return undefined;
    }

    // A plain string is already the token — there is nothing to cache or
    // refresh, and this is the shape an SSR-rendered page passes in.
    if (typeof authToken === 'string') {
      return authToken;
    }

    if (this._cache) {
      // A React component passes a new closure on every render. Swapping the
      // function keeps the cached token; rebuilding the cache would throw it
      // away and refetch on each render.
      this._cache.fetchToken = authToken;
    } else {
      this._debugPrint('Creating the auth token cache.');
      this._cache = new AuthTokenCache({ fetchToken: authToken });
    }

    return this._cache.getToken;
  }

  /** Drop the cached token, e.g. once the signed-in user changes. */
  public invalidate(): void {
    this._cache?.invalidate();
  }

  public override destroy(): void {
    super.destroy();
    this._cache = null;
  }
}
