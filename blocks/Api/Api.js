import { Block } from '../../abstract/Block.js';

export class Api extends Block {
  /**
   * @private
   * @type {Set<Function>}
   */
  _queue = new Set();

  /**
   * @private
   * @type {Boolean}
   */
  _initialized = false;

  initCallback() {
    // TODO: we need to access all the basic bound css properties
    // @ts-ignore
    this.__bindBasicCssData();
    this._initialized = true;

    for (let fn of this._queue) {
      fn();
    }
  }

  _enqueue(fn) {
    if (this._initialized) {
      return Promise.resolve(fn());
    }
    let promise = new Promise((resolve) => {
      this._queue.add(() => {
        resolve(fn());
      });
    });
    return promise;
  }

  addFiles(files) {
    return this._enqueue(() => super.addFiles(files));
  }

  getSourceList() {
    return this._enqueue(() => super.sourceList);
  }
}
