import { BaseComponent } from '@symbiotejs/symbiote';

interface RangeInitState {
  cssLeft: string;
  barActive: boolean;
  value: number;
  onChange: (e: Event) => void;
}

export class Range extends BaseComponent<RangeInitState> {
  private _range!: HTMLInputElement;

  constructor() {
    super();
    this.init$ = {
      ...this.init$,
      cssLeft: '50%',
      barActive: false,
      value: 50,
      onChange: (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.$.value = parseFloat(this._range.value);
        this.dispatchEvent(new Event('change'));
      },
    } as RangeInitState;
  }

  override initCallback(): void {
    super.initCallback();
    this._range = this.ref.range as HTMLInputElement;
    [...this.attributes].forEach((attr) => {
      const exclude = ['style', 'ref'];
      if (!exclude.includes(attr.name)) {
        this.ref.range.setAttribute(attr.name, attr.value);
      }
    });
    this.sub('value', (val: number) => {
      const pcnt = (val / 100) * 100;
      this.$.cssLeft = `${pcnt}%`;
    });
    this.defineAccessor('value', (val: number) => {
      this.$.value = val;
    });
  }
}

Range.template = /* HTML */ `
  <div class="uc-track-wrapper">
    <div class="uc-track"></div>
    <div class="uc-bar" set -style.width="cssLeft" -@active="barActive"></div>
    <div class="uc-slider" set -style.left="cssLeft"></div>
  </div>

  <input type="range" ref="range" set -@value="value" -oninput="onChange" />
`;
