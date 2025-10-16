import svgIconsSprite from '../blocks/themes/uc-basic/svg-sprite';
import { Block } from './Block';
import { solutionBlockCtx } from './CTX';

export class SolutionBlock extends Block {
  static override styleAttrs = ['uc-wgt-common'];
  protected override requireCtxName = true;
  override init$ = solutionBlockCtx(this);
  private static _template = '';

  override initCallback(): void {
    super.initCallback();
    this.a11y?.registerBlock(this);
  }

  static override set template(value: string) {
    this._template = /* html */ `${svgIconsSprite + value}<slot></slot>`;
  }

  static override get template(): string {
    return this._template;
  }
}
