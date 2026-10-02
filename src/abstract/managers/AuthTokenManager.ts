import { AuthTokenCache } from '@uploadcare/signed-uploads/client';
import { SharedInstance } from '../../lit/shared-instances';
import type { AuthToken } from '../../types/index';

/**
 * Owns the one long-lived token cache for this uploader context.
 *
 * `authToken` may be a resolver, and `@uploadcare/upload-client` calls it
 * before every authenticated request — so without a cache each upload, each
 * readiness poll and each multipart start/complete would hit the app's token
 * endpoint again. (Multipart chunks go to presigned storage URLs and carry no
 * token, so they are not part of that count.)
 */
export class AuthTokenManager extends SharedInstance {
  private _cache: AuthTokenCache | null = null;

  /**
   * The token from `fetchToken`, through the one shared cache.
   *
   * A React component passes a new closure on every render. Swapping the
   * function keeps the cached token; rebuilding the cache would throw it away
   * and refetch on each render.
   */
  private _getToken(fetchToken: () => string | Promise<string>): Promise<string> {
    if (this._cache) {
      this._cache.fetchToken = fetchToken;
    } else {
      this._debugPrint('Creating the auth token cache.');
      this._cache = new AuthTokenCache({ fetchToken });
    }

    return this._cache.getToken();
  }

  /**
   * The value to hand `@uploadcare/upload-client` as `authToken`. Unset is
   * `undefined` rather than the config's `null`, because upload-client types
   * the option as `authToken?: AuthToken`.
   */
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

    // Captures the function configured now. Callers ask again when they need
    // the current value: each upload builds its options from this, and the AI
    // Image Editor plugin re-reads it whenever `authToken` changes. A request
    // already under way keeps the function it started with.
    return () => this._getToken(authToken);
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
