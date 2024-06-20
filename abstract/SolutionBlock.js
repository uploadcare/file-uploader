import svgIconsSprite from '../blocks/themes/lr-basic/svg-sprite.js';
import { Block } from './Block.js';
import { uploaderBlockCtx } from './CTX.js';

export class SolutionBlock extends Block {
  requireCtxName = true;
  init$ = uploaderBlockCtx(this);
  _template = null;

  static set template(value) {
    SolutionBlock._template = `${svgIconsSprite + value}<slot></slot>`;
  }

  static get template() {
    return SolutionBlock._template;
  }
}
