import { LitUploaderBlock } from '../../lit/LitUploaderBlock';

export class NoWrapModeDynamicBtn extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-no-wrap-mode-dynamic-btn'];
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-no-wrap-mode-dynamic-btn': NoWrapModeDynamicBtn;
  }
}
