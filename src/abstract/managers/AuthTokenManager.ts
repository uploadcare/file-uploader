import { AuthTokenCache } from '@uploadcare/signed-uploads/client';
import { isAuthTokenResolver, normalizeAuthToken } from '@uploadcare/upload-client';
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
   *
   * A configured function comes back as a provider rather than a bare
   * function. That is what lets upload-client drop the cached token when the
   * Upload API refuses it and retry with a new one, which is how an upload
   * whose token ran out of operations recovers.
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

    // Someone else's provider: it brings its own caching and invalidation, so
    // wrapping it in ours would add a second idea of when the token is stale.
    if (typeof authToken !== 'function') {
      return authToken;
    }

    // Captures the function configured now. Callers ask again when they need
    // the current value: each upload builds its options from this, and the AI
    // Image Editor plugin re-reads it whenever `authToken` changes. A request
    // already under way keeps the function it started with.
    return {
      getToken: () => this._getToken(authToken),
      invalidate: () => this.invalidate(),
    };
  }

  /** Drop the cached token, e.g. once the signed-in user changes. */
  public invalidate(): void {
    this._cache?.invalidate();

    // A provider configured directly keeps its own token, so it is the only
    // thing that can drop that one. `normalizeAuthToken` is what knows the
    // shapes; nothing here needs to.
    const { authToken } = this._cfg;
    if (isAuthTokenResolver(authToken)) {
      normalizeAuthToken(authToken).invalidate?.();
    }
  }

  public override destroy(): void {
    super.destroy();
    this._cache = null;
  }
}
