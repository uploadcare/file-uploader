import { html } from '@symbiotejs/symbiote';
import { Block } from '../../abstract/Block';
import './select.css';

type SelectOption = {
  text: string;
  value: string;
};

type BaseInitState = InstanceType<typeof Block>['init$'];

interface SelectInitState extends BaseInitState {
  currentText: string;
  options: SelectOption[];
  selectHtml: string;
  onSelect: (event: Event) => void;
}

export class Select extends Block {
  declare ref: { select: HTMLSelectElement } & Record<string, HTMLElement>;
  declare value: string;

  constructor() {
    super();
    this.init$ = {
      ...this.init$,
      currentText: '',
      options: [],
      selectHtml: '',
      onSelect: (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        const selectElement = this.ref.select;
        this.value = selectElement.value;
        this.$.currentText =
          this.$.options.find((option: SelectOption) => {
            return option.value === this.value;
          })?.text || '';
        this.dispatchEvent(new Event('change'));
      },
    } as SelectInitState;
  }

  override initCallback(): void {
    super.initCallback();

    this.sub('options', (options: SelectOption[]) => {
      this.$.currentText = options?.[0]?.text || '';
      let htmlContent = '';
      options?.forEach((option) => {
        htmlContent += html`<option value="${option.value}">${option.text}</option>`;
      });
      this.$.selectHtml = htmlContent;
    });
  }
}

Select.template = html` <select ref="select" bind="innerHTML: selectHtml; onchange: onSelect"></select> `;
