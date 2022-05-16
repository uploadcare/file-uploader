import { Block } from '../../abstract/Block.js';

/**
 * @typedef {{
 *   '*simpleButtonText': String;
 *   onClick: () => void;
 * }} State
 */

/** @extends {Block<State>} */
export class SimpleBtn extends Block {
  /** @type {State} */
  init$ = {
    '*simpleButtonText': '',
    onClick: () => {
      this.initFlow();
    },
  };

  initCallback() {
    super.initCallback();
    let multipleStateKey = this.bindCssData('--cfg-multiple');
    this.sub(multipleStateKey, (val) => {
      this.$['*simpleButtonText'] = val ? this.l10n('upload-files') : this.l10n('upload-file');
    });
  }
}

SimpleBtn.template = /*html*/ `
<uc-drop-area>
  <button set="onclick: onClick">
    <uc-icon name="upload"></uc-icon>
    <span>{{*simpleButtonText}}</span>
    <slot></slot>
  </button>
</uc-drop-area>
`;
