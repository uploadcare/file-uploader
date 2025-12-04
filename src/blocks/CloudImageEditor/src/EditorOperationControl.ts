import { property } from 'lit/decorators.js';
import { EditorButtonControl } from './EditorButtonControl.js';
import type { ColorOperation } from './toolbar-constants';
import { COLOR_OPERATIONS_CONFIG } from './toolbar-constants.js';
import type { Transformations } from './types';
import { parseFilterValue } from './utils/parseFilterValue.js';

export class EditorOperationControl extends EditorButtonControl {
  private _operation: ColorOperation | '' = '';

  @property({ type: String })
  get operation(): ColorOperation | '' {
    return this._operation;
  }

  set operation(value: ColorOperation | '') {
    const normalizedValue = value ?? '';
    if (this._operation === normalizedValue) {
      return;
    }
    const previousValue = this._operation;
    this._operation = normalizedValue;
    this.requestUpdate('operation', previousValue);
    if (normalizedValue) {
      this.updateOperationMetadata(normalizedValue as ColorOperation);
    }
  }

  private updateOperationMetadata(operation: ColorOperation): void {
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

  override initCallback(): void {
    super.initCallback();

    if (this._operation) {
      this.updateOperationMetadata(this._operation as ColorOperation);
    }

    this.sub('*editorTransformations', (editorTransformations: Transformations) => {
      if (!this._operation) {
        return;
      }

      const { zero } = COLOR_OPERATIONS_CONFIG[this._operation];
      const value = editorTransformations[this._operation];
      const isActive = typeof value !== 'undefined' ? value !== zero : false;
      this.active = isActive;
    });
  }
  override onClick(e: MouseEvent) {
    const slider = this.$['*sliderEl'] as { setOperation: (operation: ColorOperation | '') => void } | undefined;
    slider?.setOperation(this._operation);
    this.$['*showSlider'] = true;
    this.$['*currentOperation'] = this._operation;

    this.telemetryManager.sendEventCloudImageEditor(e, this.$['*tabId'], {
      operation: parseFilterValue(this.$['*operationTooltip']),
    });
  }
}
