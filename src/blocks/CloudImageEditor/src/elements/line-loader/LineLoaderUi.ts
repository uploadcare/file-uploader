import { html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { LightDomMixin } from '../../../../../lit/LightDomMixin';
import { RegisterableElementMixin } from '../../../../../lit/RegisterableElementMixin';

// Pure presentational leaf: no editor-state/l10n/ctx dependency, so it needs
// neither `ChildBlock` nor `EditorBlock` — just the two structural mixins
// (light-DOM rendering + `reg()` registration), same base shape as
// `ChildBlockBase`/`EditorBlockBase`.
const LineLoaderUiBase = RegisterableElementMixin(LightDomMixin(LitElement));

export class LineLoaderUi extends LineLoaderUiBase {
  // The stylesheet runs the line's animation while the reflected `active` attribute is set.
  @property({ type: Boolean, reflect: true })
  public active = false;

  public override render() {
    return html`
      <div class="uc-inner">
        <div class="uc-line"></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-line-loader-ui': LineLoaderUi;
  }
}
