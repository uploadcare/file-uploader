import { AppComponent } from './AppComponent.js';
import { SliderUi } from './elements/slider/SliderUi.js';
import { COLOR_OPERATIONS_CONFIG } from './toolbar-constants.js';

const STYLES = {
  ':host': {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    height: '66px',
    alignItems: 'center',
  },
};

const ControlType = {
  FILTER: 'filter',
  COLOR_OPERATION: 'color_operation',
};

export const FAKE_ORIGINAL_FILTER = 'original';

export class EditorSlider extends AppComponent {
  constructor() {
    super();

    this.state = {
      disabled: false,
      min: 0,
      max: 100,
      value: 0,
      defaultValue: 0,
      zero: 0,
      'on.input': (value) => {
        this._faderEl.set(value);
        this.state.value = value;
      },
    };

    this.defineAccessor('faderEl', (faderEl) => {
      /** @type {import('./EditorImageFader').EditorImageFader} */
      this._faderEl = faderEl;
    });
  }

  /**
   * @param {any} operation
   * @param {any} [filter]
   */
  setOperation(operation, filter) {
    this._controlType = operation === 'filter' ? ControlType.FILTER : ControlType.COLOR_OPERATION;
    this._operation = operation;
    this._iconName = operation;
    this._title = operation.toUpperCase();
    this._filter = filter;

    this._initializeValues();

    this._faderEl.activate({
      url: this.read('*originalUrl'),
      operation: this._operation,
      value: this._filter === FAKE_ORIGINAL_FILTER ? undefined : this.state.value,
      filter: this._filter === FAKE_ORIGINAL_FILTER ? undefined : this._filter,
      fromViewer: false,
    });
  }

  _initializeValues() {
    let { range, zero } = COLOR_OPERATIONS_CONFIG[this._operation];
    let [min, max] = range;

    this.state.min = min;
    this.state.max = max;
    this.state.zero = zero;

    let transformation = this.read('*editorTransformations')[this._operation];
    if (this._controlType === ControlType.FILTER) {
      let value = max;
      if (transformation) {
        let { name, amount } = transformation;
        value = name === this._filter ? amount : max;
      }
      this.state.value = value;
      this.state.defaultValue = value;
    }
    if (this._controlType === ControlType.COLOR_OPERATION) {
      let value = typeof transformation !== 'undefined' ? transformation : zero;
      this.state.value = value;
      this.state.defaultValue = value;
    }
  }

  apply() {
    let operationValue;
    if (this._controlType === ControlType.FILTER) {
      if (this._filter === FAKE_ORIGINAL_FILTER) {
        operationValue = null;
      } else {
        operationValue = { name: this._filter, amount: this.state.value };
      }
    } else {
      operationValue = this.state.value;
    }

    /** @type {import('../../../src/types/UploadEntry.js').Transformations} */
    let transformations = {
      ...this.read('*editorTransformations'),
      [this._operation]: operationValue,
    };

    this.pub('*editorTransformations', transformations);
  }

  cancel() {
    this._faderEl.deactivate({ hide: false });
  }

  connectedCallback() {
    super.connectedCallback();

    this.sub('*originalUrl', (originalUrl) => {
      this._originalUrl = originalUrl;
    });

    this.sub('value', (value) => {
      let tooltip = `${this._filter || this._operation} ${value}`;
      this.pub('*operationTooltip', tooltip);
    });
  }
}

EditorSlider.renderShadow = false;
EditorSlider.styles = STYLES;

EditorSlider.template = /*html*/ `
<${SliderUi.is} ref="slider-el" set="disabled: disabled; min: min; max: max; defaultValue: defaultValue; zero: zero; onInput: on.input;"></${SliderUi.is}>
`;
