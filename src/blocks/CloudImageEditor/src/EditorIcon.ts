import { ContextConsumer, createContext } from '@lit/context';
import type { TemplateResult } from 'lit';
import { UcIconBase } from '../../Icon/UcIconBase';

/**
 * Renders an editor icon's content by name. The uploader's editor activity provides it so editor icons resolve like
 * `uc-icon` (plugin icons, `iconHrefResolver`); the standalone editor has no provider and keeps the built-in sprite.
 */
export const editorIconContext = createContext<((name: string) => TemplateResult) | undefined>('uc-editor-icon');

// Concrete editor icon element. Inherits the static `reg(tagName)` from
// `UcIconBase` and, because it IS exported from `CloudImageEditor/src/index.ts`
// (derived tag `uc-editor-icon`), registers via `defineComponents(UC)` like
// every other block — not a self-`customElements.define`.
export class EditorIcon extends UcIconBase {
  private readonly _renderIcon = new ContextConsumer(this, { context: editorIconContext, subscribe: true });

  public override render() {
    const renderIcon = this._renderIcon.value;
    return renderIcon && this.name ? this.yield('', renderIcon(this.name)) : super.render();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-icon': EditorIcon;
  }
}
