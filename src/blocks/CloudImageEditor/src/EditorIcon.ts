import { UcIconBase } from '../../Icon/UcIconBase';

// Concrete editor icon element. Inherits the static `reg(tagName)` from
// `UcIconBase` and, because it IS exported from `CloudImageEditor/src/index.ts`
// (derived tag `uc-editor-icon`), registers via `defineComponents(UC)` like
// every other block — not a self-`customElements.define`.
export class EditorIcon extends UcIconBase {}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-icon': EditorIcon;
  }
}
