import svgIconsSprite from '../blocks/themes/lr-basic/svg-sprite.js';
import { Block } from './Block.js';
import { uploaderBlockCtx } from './CTX.js';

export class SolutionBlock extends Block {
  static styleAttrs = ['lr-wgt-common'];
  requireCtxName = true;
  init$ = uploaderBlockCtx(this);
  _template = null;

  static set template(value) {
    this._template = svgIconsSprite + value + /** HTML */ `<slot></slot>`;
  }

  static get template() {
    return this._template;
  }
}
