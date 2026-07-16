import { UcIconBase } from '../../Icon/UcIconBase';

// Registered via `defineComponents(UC)` like every other block (exported from
// `CloudImageEditor/src/index.ts` → derived tag `uc-editor-icon`), not a
// self-`customElements.define`.
export class EditorIcon extends UcIconBase {}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-icon': EditorIcon;
  }
}
