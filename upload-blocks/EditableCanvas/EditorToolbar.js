import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { CanMan } from './CanMan.js';
import { Range } from '../Range/Range.js';
import { Color } from '../Color/Color.js';

import { getButtons } from './buttons.js';

Range.reg('range');
Color.reg('color');

const FS_ICON = {
  FS: 'fullscreen',
  EXIT: 'fullscreen-exit',
};

/**
 * @typedef {any} RefMap
 * @property {import('./EditableCanvas.js').EditableCanvas} parent
 * @property {HTMLCanvasElement} canvas
 * @property {CanvasRenderingContext2D} canvCtx
 * @property {SVGElement} svg
 * @property {SVGGElement} svgGroup
 * @property {SVGImageElement} svgImg
 */

export class EditorToolbar extends BlockComponent {
  get actionsMap() {
    return {
      fullscreen: () => {
        if (document.fullscreenElement === this.rMap.parent) {
          document.exitFullscreen();
          this.$.fsIcon = FS_ICON.FS;
        } else {
          this.rMap.parent.requestFullscreen();
          this.$.fsIcon = FS_ICON.EXIT;
        }
      },
      rotate_cw: () => {
        this.canMan.rotate();
      },
      flip_v: () => {
        this.canMan.flip('vertical');
      },
      flip_h: () => {
        this.canMan.flip('horizontal');
      },
      brightness: () => {
        this.rangeCtx = 'brightness';
        this.set$({
          rangeActive: true,
          rangeCaption: this.l10n('brightness'),
        });
      },
      contrast: () => {
        this.rangeCtx = 'contrast';
        this.set$({
          rangeActive: true,
          rangeCaption: this.l10n('contrast'),
        });
      },
      saturation: () => {
        this.rangeCtx = 'saturate';
        this.set$({
          rangeActive: true,
          rangeCaption: this.l10n('saturation'),
        });
      },
      resize: () => {
        this.canMan.resize();
      },
      crop: () => {
        this.canMan.crop();
      },
      color: () => {
        this.ref.color.dispatchEvent(new MouseEvent('click'));
      },
      text: () => {
        this.canMan.startText();
      },
      draw: () => {
        this.canMan.startDraw();
      },
      cancel: () => {
        this.canMan.restore();
      },
    };
  }

  init$ = {
    fsIcon: FS_ICON.FS,
    rangeActive: false,
    rangeCaption: '',

    onBtnClick: (e) => {
      this.canMan.stopText();
      this.rangeCtx = null;

      this.set$({
        rangeActive: false,
        rangeCaption: '',
        '*rangeValue': 100,
      });
      /** @type {HTMLButtonElement} */
      let btnEl = e.target.closest('[action]');
      if (btnEl) {
        this.buttons.add(btnEl);
        this.buttons.forEach((btn) => {
          if (btn === btnEl) {
            btn.setAttribute('current', '');
          } else {
            btn.removeAttribute('current', '');
          }
        });
      }
      let action = btnEl.getAttribute('action');
      console.log(action);
      if (!action) {
        return;
      }
      this.actionsMap[action]();
    },
  };

  buttons = new Set();
  /** @type {import('./EditableCanvas.js').EditableCanvas} */
  editor = null;

  initCallback() {
    this.defineAccessor('refMap', (/** @type {RefMap} */ rMap) => {
      if (!rMap) {
        return;
      }
      this.rMap = rMap;
      /** @type {CanMan} */
      this.canMan = new CanMan(rMap);
      console.log(rMap);
    });
    this.sub('*rangeValue', (val) => {
      this.canMan?.[this.rangeCtx]?.(val);
    });
    this.sub('*selectedColor', (val) => {
      this.canMan?.setColor(val);
    });
  }
}
EditorToolbar.template = /*html*/ `
<div 
  .btns 
  ref="btns" 
  set="onclick: onBtnClick">${getButtons()}</div>
<uc-range 
  min="0" 
  max="200" 
  ref="range"
  set="@visible: rangeActive; $.caption: rangeCaption">
</uc-range>
`;
