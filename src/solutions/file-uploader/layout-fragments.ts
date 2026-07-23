import { html, type TemplateResult } from 'lit';

/**
 * Shared light-DOM composition fragments for file-uploader solutions.
 * Pure HTML factories — no DI, no controllers. Solutions pass handlers/labels.
 */

/** Modal source picker used by regular + minimal (foreground start-from). */
export function renderModalSourcePicker(opts: {
  onCancel: () => void;
  cancelLabel: string;
  /** Regular includes copyright inside the modal; minimal does not. */
  copyright?: boolean;
}): TemplateResult {
  return html`
    <uc-modal id="start-from" strokes block-body-scrolling>
      <uc-start-from>
        <uc-drop-area with-icon clickable></uc-drop-area>
        <uc-source-list role="list" wrap></uc-source-list>
        <button type="button" class="uc-secondary-btn" @click=${opts.onCancel}>
          ${opts.cancelLabel}
        </button>
        ${opts.copyright ? html`<uc-copyright></uc-copyright>` : null}
      </uc-start-from>
    </uc-modal>
  `;
}

/** Minimal persistent empty-state trigger (background start-from). */
export function renderMinimalTrigger(opts: { single: boolean; label: string }): TemplateResult {
  return html`
    <uc-start-from>
      <uc-drop-area
        ?single=${opts.single}
        initflow
        clickable
        tabindex="0"
      ><span>${opts.label}</span></uc-drop-area>
      <uc-copyright></uc-copyright>
    </uc-start-from>
  `;
}

/** Inline start-from shell (drop area + sources + cancel + copyright). */
export function renderInlineStartFrom(opts: {
  onCancel: () => void;
  cancelLabel: string;
  cancelHidden: boolean;
}): TemplateResult {
  return html`
    <uc-start-from>
      <uc-drop-area with-icon clickable></uc-drop-area>
      <uc-source-list role="list" wrap></uc-source-list>
      <button
        type="button"
        class="uc-cancel-btn uc-secondary-btn"
        @click=${opts.onCancel}
        ?hidden=${opts.cancelHidden}
      >
        ${opts.cancelLabel}
      </button>
      <uc-copyright></uc-copyright>
    </uc-start-from>
  `;
}
