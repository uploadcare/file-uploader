import { AuthTokenCache } from '@uploadcare/signed-uploads/client';
import { isAuthTokenResolver, normalizeAuthToken } from '@uploadcare/upload-client';
import { SharedInstance } from '../../lit/shared-instances';
import type { AuthToken } from '../../types/index';

/**
 * Owns the token cache for this uploader context.
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
   * The cache serving tokens from `fetchToken`.
   *
   * A React component passes a new closure on every render. Swapping the
   * function keeps the cached token; rebuilding the cache would throw it away
   * and refetch on each render.
   */
  private _cacheFor(fetchToken: () => string | Promise<string>): AuthTokenCache {
    if (this._cache) {
      this._cache.fetchToken = fetchToken;
      return this._cache;
    }

    this._debugPrint('Creating the auth token cache.');
    this._cache = new AuthTokenCache({ fetchToken });
    return this._cache;
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

    // Bound to the cache serving the function configured now, rather than to
    // whichever one this manager holds later. Callers ask again when they need
    // the current value: each upload builds its options from this, and the AI
    // Image Editor plugin re-reads it whenever `authToken` changes. A request
    // already under way keeps both the function and the cache it started with,
    // which is what `invalidate()` relies on.
    const cache = this._cacheFor(authToken);
    return {
      getToken: cache.getToken,
      // Its own cache, which is where the token upload-client just had
      // refused came from. A provider configured directly is handed to
      // upload-client as it is and gets its own `invalidate()` call.
      invalidate: () => cache.invalidate(),
    };
  }

  /** Drop the cached token, e.g. once the signed-in user changes. */
  public invalidate(): void {
    this._cache?.invalidate();

    // Let go of the instance, do not just empty it. A provider already handed
    // out keeps the cache it was built with, so what the upload still running
    // fetches next stays with that upload. Sharing one cache instead would let
    // it refill the slot the next upload reads — and the next upload may be a
    // different signed-in user, which is usually why this was called.
    this._cache = null;

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
