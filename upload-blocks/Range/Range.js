import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class Range extends BlockComponent {
  get ev() {
    return new Event('change', {
      bubbles: false,
    });
  }

  init$ = {
    value: 100,
    cssLeft: '50%',
    caption: 'CAPTION',
    barActive: false,
    onChange: () => {
      let pcnt = (this.ref.range['value'] / this.ref.range['max']) * 100;
      this.$.cssLeft = `${pcnt}%`;
      this.value = this.ref.range['value'];
      this.dispatchEvent(this.ev);
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
      this.$.barActive = true;
      this.onmousemove = (e) => {
        this.$.cssLeft = `${e.offsetX}px`;
      };
    };
    this.onmouseup = () => {
      this.$.barActive = false;
      this.onmousemove = null;
    };
    this.onmouseleave = () => {
      this.$.barActive = false;
      this.onmousemove = null;
    };
    // this.ref.range.dispatchEvent(this.ev);
  }
}

Range.template = /*html*/ `
<datalist id="range-values">
  <option value="0" label="min"></option>
  <option value="100" label="0"></option>
  <option value="200" label="max"></option>
</datalist>
<div .track>
  <div .bar set="style.width: cssLeft; @active: barActive"></div>
  <div .slider set="style.left: cssLeft"></div>
  <div .center></div>
  <div .caption set="textContent: caption; @text: caption"></div>
</div>
<input 
  type="range"
  ref="range"
  list="range-values" 
  set="value: value; onchange: onChange">
`;
