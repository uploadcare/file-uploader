import { UcIconBase } from '../../Icon/UcIconBase';

export class EditorIcon extends UcIconBase {}

if (!customElements.get('uc-editor-icon')) {
  customElements.define('uc-editor-icon', EditorIcon);
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-icon': EditorIcon;
  }
}
