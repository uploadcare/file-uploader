import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class Range extends BlockComponent {
  init$ = {
    cssLeft: '50%',
    caption: 'CAPTION',
    barActive: false,
    '*rangeValue': 100,
    onChange: () => {
      this.$['*rangeValue'] = this.ref.range['value'];
    },
  };

  initCallback() {
    [...this.attributes].forEach((attr) => {
      let exclude = ['style', 'ref'];
      if (!exclude.includes(attr.name)) {
        this.ref.range.setAttribute(attr.name, attr.value);
      }
    });
    this.sub('*rangeValue', (val) => {
      let pcnt = (val / this.ref.range['max']) * 100;
      this.$.cssLeft = `${pcnt}%`;
    });
  }
}

Range.template = /*html*/ `
<datalist id="range-values">
  <option value="0" label="min"></option>
  <option value="100" label="0"></option>
  <option value="200" label="max"></option>
</datalist>
<div class="track">
  <div class="bar" set="style.width: cssLeft; @active: barActive"></div>
  <div class="slider" set="style.left: cssLeft"></div>
  <div class="center"></div>
  <div class="caption" set="@text: caption">{{caption}}</div>
</div>
<input 
  type="range"
  ref="range"
  list="range-values" 
  set="@value: *rangeValue; oninput: onChange">
`;
