import { property } from 'lit/decorators.js';
import { EditorButtonControl } from './EditorButtonControl.js';
import type { ColorOperation } from './toolbar-constants';
import { COLOR_OPERATIONS_CONFIG } from './toolbar-constants.js';
import type { Transformations } from './types';
import { parseFilterValue } from './utils/parseFilterValue.js';

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
      const label = this.l10n('a11y-cloud-editor-apply-tuning', {
        name: this.l10n(operation).toLowerCase(),
      });
      this.titleProp = label;
      return label;
    };

    const resolveTitle = () => {
      const titleText = this.l10n(operation);
      this.title = titleText;
      return titleText;
    };

    resolveTitleProp();
    resolveTitle();
  }

  public override contextConsumedCallback(): void {
    super.contextConsumedCallback();

    if (this._operation) {
      this._updateOperationMetadata(this._operation as ColorOperation);
    }

    this.editorSub('*editorTransformations', (editorTransformations: Transformations) => {
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
    const slider = this.editor$['*sliderEl'] as { setOperation: (operation: ColorOperation | '') => void } | undefined;
    slider?.setOperation(this._operation);
    this.editor$['*showSlider'] = true;
    this.editor$['*currentOperation'] = this._operation || null;

    this.telemetryManager.sendEventCloudImageEditor(e, this.editor$['*tabId'], {
      operation: parseFilterValue(this.editor$['*operationTooltip']),
    });
  }
}
