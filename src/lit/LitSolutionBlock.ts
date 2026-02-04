import { html } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { solutionBlockCtx } from '../abstract/CTX';
import svgIconsSprite from '../blocks/themes/uc-basic/svg-sprite';
import { LitBlock } from './LitBlock';

export class LitSolutionBlock extends LitBlock {
  public static override styleAttrs = ['uc-wgt-common'];
  public override init$ = solutionBlockCtx(this);

  public override initCallback(): void {
    super.initCallback();
    this.a11y?.registerBlock(this);
    this.sharedCtx.pub('*solution', this.tagName);
  }

  public override render() {
    return html`${unsafeSVG(svgIconsSprite)}`;
  }
}
