import { ShadowWrapper } from '../blocks/ShadowWrapper/ShadowWrapper.js';
import { uploaderBlockCtx } from './CTX.js';

export class SolutionBlock extends ShadowWrapper {
  ctxInit = uploaderBlockCtx(this);
  ctxOwner = true;

  /**
   * @private
   * @type {String}
   */
  static _template = null;

  /**
   * @param {String} value
   * @public
   */
  static set template(value) {
    this._template = value + /** HTML */ `<slot></slot>`;
  }

  /**
   * @returns {String}
   * @public
   */
  static get template() {
    return this._template;
  }
}
