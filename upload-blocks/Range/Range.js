import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class Range extends BlockComponent {
  init$ = {
    value: '',
    cssLeft: '50%',
    caption: 'BRIGHTNESS',
    on_change: () => {
      let pcnt = (this.ref.range['value'] / this.ref.range['max']) * 100;
      this.$.cssLeft = `${pcnt}%`;
      this.value = this.ref.range['value'];
      this.dispatchEvent(new Event('change'));
    },
  };

  setValue(val) {
    this.$.value = val;
  }

  initCallback() {
    [...this.attributes].forEach((attr) => {
      let exclude = ['style'];
      if (!exclude.includes(attr.name)) {
        this.ref.range.setAttribute(attr.name, attr.value);
      }
    });
    this.onmousedown = () => {
      this.onmousemove = (e) => {
        this.$.cssLeft = `${e.offsetX}px`;
      };
    };
    this.onmouseup = () => {
      this.onmousemove = null;
    };
    this.onmouseleave = () => {
      this.onmousemove = null;
    };
    this.ref.range.dispatchEvent(new Event('change'));
  }
}

Range.template = /*html*/ `
<datalist id="range-values">
  <option value="0" label="min"></option>
  <option value="100" label="0"></option>
  <option value="200" label="max"></option>
</datalist>
<div ref="track" .track>
  <div ref="bar" .bar set="style.width: cssLeft"></div>
  <div ref="slider" .slider set="style.left: cssLeft"></div>
  <div ref="center" .center></div>
  <div .caption set="textContent: caption"></div>
</div>
<input 
  type="range"
  ref="range"
  list="range-values" 
  set="value: value; onchange: on_change">
`;
