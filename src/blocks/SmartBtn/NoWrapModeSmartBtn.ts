import { LitUploaderBlock } from '../../lit/LitUploaderBlock';

export class NoWrapModeSmartBtn extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-no-wrap-mode-smart-btn'];
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-no-wrap-mode-smart-btn': NoWrapModeSmartBtn;
  }
}
