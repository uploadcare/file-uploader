import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { applyStyles } from '../../symbiote/utils/dom-helpers.js';

export class Range extends BlockComponent {
  constructor() {
    super();
    applyStyles(this, {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
  }

  setValue(val) {
    this.ref.range['value'] = val;
    this.ref.slider.style.left = '50%';
  }

  initCallback() {
    applyStyles(this.ref.range, {
      opacity: 0.5,
      height: '100%',
      width: '100%',
    });
    applyStyles(this.ref.track, {
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      pointerEvents: 'none',
      backgroundColor: '#000',
      left: 0,
      right: 0,
      height: '10px',
    });
    applyStyles(this.ref.slider, {
      position: 'absolute',
      backgroundColor: '#f00',
      height: '20px',
      width: '20px',
      borderRadius: '100%',
      transform: 'translateX(-50%)',
    });
    applyStyles(this.ref.center, {
      position: 'absolute',
      backgroundColor: '#fff',
      height: '3px',
      width: '3px',
      left: '50%',
      borderRadius: '100%',
      transform: 'translateX(-50%)',
    });
    [...this.attributes].forEach((attr) => {
      let exclude = ['style'];
      if (!exclude.includes(attr.name)) {
        this.ref.range.setAttribute(attr.name, attr.value);
      }
    });
    this.ref.range.onchange = (e) => {
      let pcnt = (this.ref.range['value'] / this.ref.range['max']) * 100;
      this.ref.slider.style.left = `${pcnt}%`;
      this.value = this.ref.range['value'];
      this.dispatchEvent(new Event('change'));
      // console.log(this.value);
    };
    this.onmousedown = () => {
      this.onmousemove = (e) => {
        this.ref.slider.style.left = `${e.offsetX}px`;
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
<datalist id="range-values" hidden>
  <option value="0" label="min"></option>
  <option value="100" label="0"></option>
  <option value="200" label="max"></option>
</datalist>
<input ref="range" list="range-values" type="range">
<div ref="track" .track>
  <div ref="slider" .slider></div>
  <div ref="center" .center></div>
</div>
`;
