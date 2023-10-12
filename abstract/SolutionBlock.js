import { ShadowWrapper } from '../blocks/ShadowWrapper/ShadowWrapper.js';
import { uploaderBlockCtx } from './CTX.js';

export class SolutionBlock extends ShadowWrapper {
  requireCtxName = true;
  init$ = uploaderBlockCtx(this);
  _template = null;

  static set template(value) {
    this._template = value + /** HTML */ `<slot></slot>`;
  }

  static get template() {
    return this._template;
  }
}
