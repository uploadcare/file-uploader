import { applyAttributes, applyStyles } from '../../symbiote/utils/dom-helpers.js';
import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { CanMan } from './CanMan.js';
import { Range } from '../Range/Range.js';

import { getButtons } from './buttons.js';

Range.reg('range');

const FS_ICON = {
  FS: 'fullscreen',
  EXIT: 'fullscreen-exit',
};

export class EditorToolbar extends BlockComponent {
  get actionsMap() {
    return {
      fullscreen: () => {
        if (document.fullscreenElement === this.editor) {
          document.exitFullscreen();
          this.pub('local', 'fsIcon', FS_ICON.FS);
        } else {
          this.editor.requestFullscreen();
          this.pub('local', 'fsIcon', FS_ICON.EXIT);
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
        this.multiPub('local', {
          rangeActive: true,
          rangeCaption: this.l10n('brightness'),
        });
      },
      contrast: () => {
        this.rangeCtx = 'contrast';
        this.multiPub('local', {
          rangeActive: true,
          rangeCaption: this.l10n('contrast'),
        });
      },
      saturation: () => {
        this.rangeCtx = 'saturate';
        this.multiPub('local', {
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

  constructor() {
    super();
    this.buttons = new Set();

    /** @type {import('./EditableCanvas.js').EditableCanvas} */
    this.editor = null;
    this.initLocalState({
      fsIcon: FS_ICON.FS,
      rangeActive: false,
      rangeCaption: '',

      onBtnClick: (e) => {
        this.canMan.stopText();
        this.rangeCtx = null;
        this.ref.range['setValue'](100);
        this.multiPub('local', {
          rangeActive: false,
          rangeCaption: '',
        });
        /** @type {HTMLButtonElement} */
        let btnEl = e.target.closest('button');
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
      onRangeChange: () => {
        this.canMan?.[this.rangeCtx]?.(this.ref.range['value']);
      },
      onColorChange: () => {
        this.ref.color_btn.style.color = this.ref.color['value'];
        this.canMan.setColor(this.ref.color['value']);
      },
    });
  }

  initCallback() {
    this.ref.color_btn.style.color = CanMan.defaultColor;
    this.defineAccessor('refMap', (rMap) => {
      if (!rMap) {
        return;
      }
      /** @type {CanMan} */
      this.canMan = new CanMan(rMap);
      console.log(rMap);
    });
  }
}
EditorToolbar.template = /*html*/ `
<div .btns ref="btns" loc="onclick: onBtnClick">${getButtons()}</div>
<div .range-caption loc="textContent: rangeCaption"></div>
<uc-range 
  min="0" 
  max="200" 
  value="100" 
  ref="range"
  loc="onchange: onRangeChange; @visible: rangeActive">
</uc-range>
<input ref="color" value="${CanMan.defaultColor}" type="color" loc="onchange: onColorChange">
`;
