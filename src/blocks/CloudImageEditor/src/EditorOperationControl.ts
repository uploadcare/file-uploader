import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { EditorButtonControl } from './EditorButtonControl.js';
import type { ColorOperation } from './toolbar-constants';
import { COLOR_OPERATIONS_CONFIG } from './toolbar-constants.js';

/** Bubbles up to `EditorToolbar`, which owns the toolbar-local `currentOperation`/`showSlider` state and the slider ref. */
export class OperationSelectEvent extends Event {
  public static readonly eventName = 'uc-internal:operation-select';
  public constructor(
    public readonly operation: ColorOperation | '',
    public readonly originalEvent: MouseEvent,
  ) {
    super(OperationSelectEvent.eventName, { bubbles: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    [OperationSelectEvent.eventName]: OperationSelectEvent;
  }
}

export class EditorOperationControl extends EditorButtonControl {
  @property({ type: String })
  public operation: ColorOperation | '' = '';

  // Derived here, not in `render`, so the base's `updated` sees `active` change and toggles the host classes.
  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);
    const controller = this.editorControllerOrNull;
    if (!controller || !this.operation) return;
    const { zero } = COLOR_OPERATIONS_CONFIG[this.operation];
    const value = controller.editorTransformations[this.operation];
    this.active = typeof value !== 'undefined' ? value !== zero : false;
  }

  protected override updateLabels(): void {
    const { operation } = this;
    if (!operation) return;
    this.icon = operation;
    this.caption = this.l10nSafe(operation);
    this.buttonLabel = this.l10nSafe('a11y-cloud-editor-apply-tuning', { name: this.caption.toLowerCase() });
  }

  protected override onClick(e: MouseEvent) {
    this.dispatchEvent(new OperationSelectEvent(this.operation, e));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-operation-control': EditorOperationControl;
  }
}
