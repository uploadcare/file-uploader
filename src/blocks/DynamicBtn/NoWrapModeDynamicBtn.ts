import { ChildBlock } from '../../lit/ChildBlock';

export class NoWrapModeDynamicBtn extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-no-wrap-mode-dynamic-btn'];
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-no-wrap-mode-dynamic-btn': NoWrapModeDynamicBtn;
  }
}
