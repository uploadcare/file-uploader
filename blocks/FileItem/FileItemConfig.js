//@ts-check
import { UploaderBlock } from '../../abstract/UploaderBlock.js';

export class FileItemConfig extends UploaderBlock {
  /** @protected */
  _entrySubs = new Set();

  /**
   * @type {import('../../abstract/uploadEntrySchema.js').UploadEntryTypedData | null}
   * @protected
   */
  _entry = null;

  /**
   * @template {any[]} A
   * @template {(entry: import('../../abstract/uploadEntrySchema.js').UploadEntryTypedData, ...args: A) => any} T
   * @param {T} fn
   * @returns {(...args: A) => ReturnType<T>}
   * @protected
   */
  _withEntry(fn) {
    const wrapperFn = /** @type {(...args: A) => ReturnType<T>} */ (
      (...args) => {
        const entry = this._entry;
        if (!entry) {
          console.warn('No entry found');
          return;
        }
        return fn(entry, ...args);
      }
    );
    return wrapperFn;
  }

  /**
   * @template {import('../../abstract/uploadEntrySchema.js').UploadEntryKeys} K
   * @param {K} prop_
   * @param {(value: import('../../abstract/uploadEntrySchema.js').UploadEntryData[K]) => void} handler_
   * @protected
   */
  _subEntry(prop_, handler_) {
    return this._withEntry(
      /**
       * @template {import('../../abstract/uploadEntrySchema.js').UploadEntryKeys} K
       * @param {import('../../abstract/uploadEntrySchema.js').UploadEntryTypedData} entry
       * @param {K} prop
       * @param {(value: import('../../abstract/uploadEntrySchema.js').UploadEntryData[K]) => void} handler
       */
      (entry, prop, handler) => {
        let sub = entry.subscribe(prop, (value) => {
          if (this.isConnected) {
            handler(value);
          }
        });
        this._entrySubs.add(sub);
      },
    )(prop_, handler_);
  }

  /** @protected */
  _reset() {
    for (let sub of this._entrySubs) {
      sub.remove();
    }

    this._entrySubs = new Set();
    this._entry = null;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._entrySubs = new Set();
  }
}
