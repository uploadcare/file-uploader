import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { LitBlock } from '../../../lit/LitBlock';
import type { EditorImageFader } from './EditorImageFader';
import type { ColorOperation, FilterId } from './toolbar-constants';
import { COLOR_OPERATIONS_CONFIG } from './toolbar-constants';
import type { Transformations } from './types';

type SliderOperation = ColorOperation | 'filter';
type SliderFilter = FilterId | typeof FAKE_ORIGINAL_FILTER;

export const FAKE_ORIGINAL_FILTER = 'original';

export class EditorSlider extends LitBlock {
  @state()
  private state = {
    operation: 'filter' as SliderOperation,
    filter: undefined as SliderFilter | undefined,
    originalUrl: '',
    disabled: false,
    min: 0,
    max: 100,
    value: 0,
    defaultValue: 0,
    zero: 0,
  };

  handleInput = (e: CustomEvent<{ value: number }>): void => {
    const { value } = e.detail;
    const fader = this.$['*faderEl'] as EditorImageFader | undefined;
    fader?.set(value);
    this.state = { ...this.state, value };
  };

  public setOperation(operation: SliderOperation, filter?: SliderFilter): void {
    this.state = { ...this.state, operation, filter };

    this._initializeValues();

    const fader = this.$['*faderEl'] as EditorImageFader | undefined;
    const originalUrl = this.state.originalUrl || (this.$['*originalUrl'] as string | undefined);
    if (fader && originalUrl) {
      fader.activate({
        url: originalUrl,
        operation: this.state.operation,
        value: this.state.filter === FAKE_ORIGINAL_FILTER ? undefined : this.state.value,
        filter: this.state.filter === FAKE_ORIGINAL_FILTER ? undefined : this.state.filter,
        fromViewer: false,
      });
    }
  }

  private _initializeValues(): void {
    const operation = this.state.operation;
    const { range, zero } = COLOR_OPERATIONS_CONFIG[operation];
    const [min, max] = range;

    this.state = { ...this.state, min, max, zero };

    const editorTransformations = this.$['*editorTransformations'] as Transformations;
    const transformation = editorTransformations[operation];

    if (operation === 'filter') {
      let value = Number(max);
      const filterTransformation = transformation as Transformations['filter'] | undefined;
      if (filterTransformation) {
        const { name, amount } = filterTransformation;
        value = name === this.state.filter ? amount : max;
      }
      this.state = { ...this.state, value, defaultValue: value };
      return;
    }

    const value = typeof transformation !== 'undefined' ? (transformation as number) : zero;
    this.state = { ...this.state, value, defaultValue: value };
  }

  apply(): void {
    const editorTransformations = this.$['*editorTransformations'] as Transformations;
    const transformations: Transformations = { ...editorTransformations };

    if (this.state.operation === 'filter') {
      if (!this.state.filter || this.state.filter === FAKE_ORIGINAL_FILTER) {
        delete transformations.filter;
      } else {
        transformations.filter = { name: this.state.filter, amount: this.state.value };
      }
    } else {
      transformations[this.state.operation] = this.state.value as Transformations[typeof this.state.operation];
    }

    this.$['*editorTransformations'] = transformations;
  }

  cancel(): void {
    const fader = this.$['*faderEl'] as EditorImageFader | undefined;
    fader?.deactivate({ hide: false });
  }

  override initCallback(): void {
    this.sub('*originalUrl', (originalUrl: string) => {
      this.state = { ...this.state, originalUrl };
    });
  }

  protected override updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);

    if (changedProperties.has('state')) {
      const tooltip = `${this.state.filter ?? this.state.operation} ${this.state.value}`;
      this.$['*operationTooltip'] = tooltip;
    }
  }

  override render() {
    return html`
      <uc-slider-ui
        .disabled=${this.state.disabled}
        .min=${this.state.min}
        .max=${this.state.max}
        .defaultValue=${this.state.defaultValue}
        .zero=${this.state.zero}
        @slider-input=${this.handleInput}
      ></uc-slider-ui>
    `;
  }
}
