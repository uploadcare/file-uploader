//@ts-check

/**
 * @typedef {Object} SessionStorageOptions
 * @property {string} storageKey - The key to use for session storage
 */

export class SessionStorage {
  /** @param {SessionStorageOptions} opt */
  constructor(opt) {
    /** @type {string} */
    this._storageKey = opt.storageKey;
  }

  /** @returns {Record<string, any>} */
  _load() {
    try {
      const raw = sessionStorage.getItem(this._storageKey);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }

  /** @param {Record<string, string>} map */
  _save(map) {
    try {
      sessionStorage.setItem(this._storageKey, JSON.stringify(map));
    } catch {}
  }

  /**
   * @param {string} hash
   * @param {unknown} value
   */
  add(hash, value) {
    const map = this._load();
    map[hash] = value;
    this._save(map);
  }

  /**
   * @param {string} hash
   * @returns {unknown}
   */
  check(hash) {
    const map = this._load();
    return map[hash];
  }
}

/**
 * Session storage instance for managing aspect ratio data
 *
 * @type {SessionStorage}
 */
export const storageAspectRatio = new SessionStorage({ storageKey: 'editor.aspectRatios' });
