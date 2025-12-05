import { html } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { solutionBlockCtx } from '../abstract/CTX';
import svgIconsSprite from '../blocks/themes/uc-basic/svg-sprite';
import { LitBlock } from './LitBlock';

export class LitSolutionBlock extends LitBlock {
  static override styleAttrs = ['uc-wgt-common'];
  override init$ = solutionBlockCtx(this);

  override initCallback(): void {
    super.initCallback();
    this.a11y?.registerBlock(this);
  }

  override render() {
    return html`${unsafeSVG(svgIconsSprite)}`;
  }
}
