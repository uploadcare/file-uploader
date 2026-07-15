import { property } from 'lit/decorators.js';
import { EditorButtonControl } from './EditorButtonControl.js';
import type { ColorOperation } from './toolbar-constants';
import { COLOR_OPERATIONS_CONFIG } from './toolbar-constants.js';
import type { Transformations } from './types';

/** Bubbles up to `EditorToolbar`, which owns the toolbar-local `currentOperation`/`showSlider` state and the slider ref. */
export class OperationSelectEvent extends Event {
  public static readonly eventName = 'uc-operation-select';
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
  private _operation: ColorOperation | '' = '';

  @property({ type: String })
  public get operation(): ColorOperation | '' {
    return this._operation;
  }

  public set operation(value: ColorOperation | '') {
    const normalizedValue = value ?? '';
    if (this._operation === normalizedValue) {
      return;
    }
    const previousValue = this._operation;
    this._operation = normalizedValue;
    this.requestUpdate('operation', previousValue);
    if (this.isConnected && normalizedValue) {
      this._updateOperationMetadata(normalizedValue as ColorOperation);
    }
  }

  private _updateOperationMetadata(operation: ColorOperation): void {
    this.icon = operation;

    const resolveTitleProp = () => {
      const label = this.l10nSafe('a11y-cloud-editor-apply-tuning', {
        name: this.l10nSafe(operation).toLowerCase(),
      });
      this.titleProp = label;
      return label;
    };

    const resolveTitle = () => {
      const titleText = this.l10nSafe(operation);
      this.title = titleText;
      return titleText;
    };

    resolveTitleProp();
    resolveTitle();
  }

  public constructor() {
    super();

    // The `operation` prop is typically set (by `EditorToolbar`'s template
    // binding) before the editor context finishes resolving, so the one-shot
    // `_updateOperationMetadata` call from the property setter below can run
    // with no controller yet (`l10nSafe` falling back to the raw key). Redo
    // it once the controller actually attaches so the real l10n labels land.
    this.onEditorAttach(() => {
      if (this._operation) {
        this._updateOperationMetadata(this._operation as ColorOperation);
      }
    });

    this.subEditorKey('*editorTransformations', (editorTransformations: Transformations) => {
      if (!this._operation) {
        return;
      }

      const { zero } = COLOR_OPERATIONS_CONFIG[this._operation];
      const value = editorTransformations[this._operation];
      const isActive = typeof value !== 'undefined' ? value !== zero : false;
      this.active = isActive;
    });
  }

  protected override onClick(e: MouseEvent) {
    this.dispatchEvent(new OperationSelectEvent(this._operation, e));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-operation-control': EditorOperationControl;
  }
}
