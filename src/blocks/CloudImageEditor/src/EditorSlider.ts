import { html } from '@symbiotejs/symbiote';
import { Block } from '../../../abstract/Block';
import type { EditorImageFader } from './EditorImageFader';
import type { ColorOperation, FilterId } from './toolbar-constants';
import { COLOR_OPERATIONS_CONFIG } from './toolbar-constants';
import type { Transformations } from './types';

type SliderOperation = ColorOperation | 'filter';
type SliderFilter = FilterId | typeof FAKE_ORIGINAL_FILTER;

export const FAKE_ORIGINAL_FILTER = 'original';

export class EditorSlider extends Block {
  private _operation: SliderOperation = 'filter';
  private _filter?: SliderFilter;
  private _originalUrl = '';

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      disabled: false,
      min: 0,
      max: 100,
      value: 0,
      defaultValue: 0,
      zero: 0,
      'on.input': (value: number) => {
        const fader = this.$['*faderEl'] as EditorImageFader | undefined;
        fader?.set(value);
        this.$.value = value;
      },
    };
  }

  setOperation(operation: SliderOperation, filter?: SliderFilter): void {
    this._operation = operation;
    this._filter = filter;

    this._initializeValues();

    const fader = this.$['*faderEl'] as EditorImageFader | undefined;
    const originalUrl = this._originalUrl || (this.$['*originalUrl'] as string | undefined);
    if (fader && originalUrl) {
      fader.activate({
        url: originalUrl,
        operation: this._operation,
        value: this._filter === FAKE_ORIGINAL_FILTER ? undefined : (this.$.value as number),
        filter: this._filter === FAKE_ORIGINAL_FILTER ? undefined : this._filter,
        fromViewer: false,
      });
    }
  }

  private _initializeValues(): void {
    const operation = this._operation;
    const { range, zero } = COLOR_OPERATIONS_CONFIG[operation];
    const [min, max] = range;

    this.$.min = min;
    this.$.max = max;
    this.$.zero = zero;

    const editorTransformations = this.$['*editorTransformations'] as Transformations;
    const transformation = editorTransformations[operation];

    if (operation === 'filter') {
      let value = Number(max);
      const filterTransformation = transformation as Transformations['filter'] | undefined;
      if (filterTransformation) {
        const { name, amount } = filterTransformation;
        value = name === this._filter ? amount : max;
      }
      this.$.value = value;
      this.$.defaultValue = value;
      return;
    }

    const value = typeof transformation !== 'undefined' ? (transformation as number) : zero;
    this.$.value = value;
    this.$.defaultValue = value;
  }

  apply(): void {
    const editorTransformations = this.$['*editorTransformations'] as Transformations;
    const transformations: Transformations = { ...editorTransformations };

    if (this._operation === 'filter') {
      if (!this._filter || this._filter === FAKE_ORIGINAL_FILTER) {
        delete transformations.filter;
      } else {
        transformations.filter = { name: this._filter, amount: this.$.value as number };
      }
    } else {
      transformations[this._operation] = this.$.value as Transformations[typeof this._operation];
    }

    this.$['*editorTransformations'] = transformations;
  }

  cancel(): void {
    const fader = this.$['*faderEl'] as EditorImageFader | undefined;
    fader?.deactivate({ hide: false });
  }

  override initCallback(): void {
    super.initCallback();

    this.sub('*originalUrl', (originalUrl: string) => {
      this._originalUrl = originalUrl;
    });

    this.sub('value', (value: number) => {
      const tooltip = `${this._filter ?? this._operation} ${value}`;
      this.$['*operationTooltip'] = tooltip;
    });
  }
}

EditorSlider.template = html`
  <uc-slider-ui
    ref="slider-el"
    bind="disabled: disabled; min: min; max: max; defaultValue: defaultValue; zero: zero; onInput: on.input;"
  ></uc-slider-ui>
`;
