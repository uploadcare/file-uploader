import { uploaderBlockCtx } from './CTX.js';
import { Block } from './Block.js';

export class SolutionBlock extends Block {
  requireCtxName = true;
  init$ = uploaderBlockCtx(this);
  _template = null;

  static set template(value) {
    this._template = value + /** HTML */ `<slot></slot>`;
  }

  static get template() {
    return this._template;
  }

  shadowReadyCallback() {}

  initCallback() {
    super.initCallback();

    this.render();
    this.shadowReadyCallback();
  }
}
