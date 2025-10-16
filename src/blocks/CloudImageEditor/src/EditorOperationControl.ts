import { EditorButtonControl } from './EditorButtonControl.js';
import type { ColorOperation } from './toolbar-constants';
import { COLOR_OPERATIONS_CONFIG } from './toolbar-constants.js';
import type { Transformations } from './types';
import { parseFilterValue } from './utils/parseFilterValue.js';

export class EditorOperationControl extends EditorButtonControl {
  private _operation: ColorOperation | '' = '';

  override initCallback(): void {
    super.initCallback();

    this.$['on.click'] = (e: MouseEvent) => {
      const slider = this.$['*sliderEl'] as { setOperation: (operation: ColorOperation | '') => void };
      slider.setOperation(this._operation);
      this.$['*showSlider'] = true;
      this.$['*currentOperation'] = this._operation;

      this.telemetryManager.sendEventCloudImageEditor(e, this.$['*tabId'], {
        operation: parseFilterValue(this.$['*operationTooltip']),
      });
    };

    this.defineAccessor('operation', (operation: ColorOperation) => {
      if (operation) {
        this._operation = operation;
        this.$.icon = operation;
        this.bindL10n('title-prop', () =>
          this.l10n('a11y-cloud-editor-apply-tuning', {
            name: this.l10n(operation).toLowerCase(),
          }),
        );
        this.bindL10n('title', () => this.l10n(operation));
      }
    });

    this.sub('*editorTransformations', (editorTransformations: Transformations) => {
      if (!this._operation) {
        return;
      }

      const { zero } = COLOR_OPERATIONS_CONFIG[this._operation];
      const value = editorTransformations[this._operation];
      const isActive = typeof value !== 'undefined' ? value !== zero : false;
      this.$.active = isActive;
    });
  }
}
