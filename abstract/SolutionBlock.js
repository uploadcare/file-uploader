import svgIconsSprite from '../blocks/themes/uc-basic/svg-sprite.js';
import { Block } from './Block.js';
import { uploaderBlockCtx } from './CTX.js';

export class SolutionBlock extends Block {
  static styleAttrs = ['uc-wgt-common'];
  requireCtxName = true;
  init$ = uploaderBlockCtx(this);
  _template = null;

  initCallback() {
    super.initCallback();
    this.a11y?.registerBlock(this);
  }

  static set template(value) {
    this._template = svgIconsSprite + value + /** HTML */ `<slot></slot>`;
  }

  static get template() {
    return this._template;
  }
}
