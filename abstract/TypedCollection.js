// @ts-check
import { Data, UID } from '@symbiotejs/symbiote';
import { TypedData } from './TypedData.js';

/**
 * @template {import('./TypedData.js').TypedSchema} T
 * @typedef {(list: string[], added: Set<import('./TypedData.js').TypedData<T>>, removed: Set<TypedData<T>>) => void} TypedCollectionObserverHandler
 */

/** @template {import('./TypedData.js').TypedSchema} T */
export class TypedCollection {
  /**
   * @param {Object} options
   * @param {T} options.typedSchema
   * @param {import('./TypedData.js').ExtractKeysFromSchema<T>[]} [options.watchList]
   * @param {TypedCollectionObserverHandler<T>} [options.handler]
   * @param {string} [options.ctxName]
   */
  constructor(options) {
    /**
     * @private
     * @type {T}
     */
    this.__typedSchema = options.typedSchema;
    /**
     * @private
     * @type {string}
     */
    this.__ctxId = options.ctxName || UID.generate();
    /**
     * @private
     * @type {Data}
     */
    this.__data = Data.registerCtx({}, this.__ctxId);
    /**
     * @private
     * @type {import('./TypedData.js').ExtractKeysFromSchema<T>[]}
     */
    this.__watchList = options.watchList || [];
    /**
     * @private
     * @type {Object<string, ReturnType<TypedData<T>['subscribe']>[]>}
     */
    this.__subsMap = Object.create(null);
    /**
     * @private
     * @type {Set<Function>}
     */
    this.__propertyObservers = new Set();
    /**
     * @private
     * @type {Set<TypedCollectionObserverHandler<T>>}
     */
    this.__collectionObservers = new Set();
    /**
     * @private
     * @type {Set<string>}
     */
    this.__items = new Set();
    /**
     * @private
     * @type {Set<import('./TypedData.js').TypedData<T>>}
     */
    this.__removed = new Set();
    /**
     * @private
     * @type {Set<import('./TypedData.js').TypedData<T>>}
     */
    this.__added = new Set();

    let changeMap = Object.create(null);

    /**
     * @private
     * @param {String} propName
     * @param {String} ctxId
     */
    this.__notifyObservers = (propName, ctxId) => {
      if (this.__observeTimeout) {
        window.clearTimeout(this.__observeTimeout);
      }
      if (!changeMap[propName]) {
        changeMap[propName] = new Set();
      }
      changeMap[propName].add(ctxId);
      /** @private */
      this.__observeTimeout = window.setTimeout(() => {
        if (Object.keys(changeMap).length === 0) {
          return;
        }
        this.__propertyObservers.forEach((handler) => {
          handler({ ...changeMap });
        });
        changeMap = Object.create(null);
      });
    };
  }

  notify() {
    if (this.__notifyTimeout) {
      window.clearTimeout(this.__notifyTimeout);
    }
    /** @private */
    this.__notifyTimeout = window.setTimeout(() => {
      let added = new Set(this.__added);
      let removed = new Set(this.__removed);
      this.__added.clear();
      this.__removed.clear();
      for (const handler of this.__collectionObservers) {
        handler?.([...this.__items], added, removed);
      }
    });
  }

  /** @param {TypedCollectionObserverHandler<T>} handler */
  observeCollection(handler) {
    this.__collectionObservers.add(handler);

    if (this.__items.size > 0) {
      this.notify();
    }

    return () => {
      this.unobserveCollection(handler);
    };
  }

  /** @param {TypedCollectionObserverHandler<T>} handler */
  unobserveCollection(handler) {
    this.__collectionObservers?.delete(handler);
  }

  /**
   * @param {Partial<import('./TypedData.js').ExtractDataFromSchema<T>>} init
   * @returns {string}
   */
  add(init) {
    let item = new TypedData(this.__typedSchema);
    for (let [prop, value] of Object.entries(init)) {
      item.setValue(/** @type {import('./TypedData.js').ExtractKeysFromSchema<T>} */ (prop), value);
    }
    this.__items.add(item.uid);
    this.notify();

    this.__data.add(item.uid, item);
    this.__added.add(item);
    this.__watchList.forEach((propName) => {
      if (!this.__subsMap[item.uid]) {
        this.__subsMap[item.uid] = /** @type {ReturnType<TypedData<T>['subscribe']>[]} */ ([]);
      }
      this.__subsMap[item.uid].push(
        item.subscribe(propName, () => {
          this.__notifyObservers(propName, item.uid);
        }),
      );
    });
    return item.uid;
  }

  /**
   * @param {string} id
   * @returns {TypedData<T> | null}
   */
  read(id) {
    return this.__data.read(id);
  }

  /**
   * @template {import('./TypedData.js').ExtractKeysFromSchema<T>} K
   * @param {string} id
   * @param {K} propName
   * @returns {import('./TypedData.js').ExtractDataFromSchema<T>[propName] | null}
   */
  readProp(id, propName) {
    let item = this.read(id);
    if (!item) {
      console.warn(`Item with id ${id} not found`);
      return null;
    }
    return item.getValue(propName);
  }

  /**
   * @template {import('./TypedData.js').ExtractKeysFromSchema<T>} K
   * @param {string} id
   * @param {K} propName
   * @param {import('./TypedData.js').ExtractDataFromSchema<T>[K]} value
   */
  publishProp(id, propName, value) {
    let item = this.read(id);
    if (!item) {
      console.warn(`Item with id ${id} not found`);
      return;
    }
    item.setValue(propName, value);
  }

  /** @param {string} id */
  remove(id) {
    let item = this.read(id);
    if (item) {
      this.__removed.add(item);
    }
    this.__items.delete(id);
    this.notify();
    this.__data.pub(id, null);
    delete this.__subsMap[id];
  }

  clearAll() {
    this.__items.forEach((id) => {
      this.remove(id);
    });
  }

  /** @param {Function} handler */
  observeProperties(handler) {
    this.__propertyObservers.add(handler);

    return () => {
      this.unobserveProperties(handler);
    };
  }

  /** @param {Function} handler */
  unobserveProperties(handler) {
    this.__propertyObservers?.delete(handler);
  }

  /**
   * @param {(item: TypedData<T>) => Boolean} checkFn
   * @returns {string[]}
   */
  findItems(checkFn) {
    /** @type {string[]} */
    let result = [];
    this.__items.forEach((id) => {
      let item = this.read(id);
      if (item && checkFn(item)) {
        result.push(id);
      }
    });
    return result;
  }

  items() {
    return [...this.__items];
  }

  get size() {
    return this.__items.size;
  }

  destroy() {
    Data.deleteCtx(this.__ctxId);
    this.__propertyObservers = new Set();
    this.__collectionObservers = new Set();
    for (let id in this.__subsMap) {
      this.__subsMap[id].forEach((sub) => {
        sub.remove();
      });
      delete this.__subsMap[id];
    }
  }
}
