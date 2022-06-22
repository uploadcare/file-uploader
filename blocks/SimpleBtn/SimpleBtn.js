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
    this.bindCssData('--cfg-multiple');
    this.sub('--cfg-multiple', (val) => {
      this.$['*simpleButtonText'] = val ? this.l10n('upload-files') : this.l10n('upload-file');
    });
  }
}

SimpleBtn.template = /*html*/ `
<lr-drop-area>
  <button type="button" set="onclick: onClick">
    <lr-icon name="upload"></lr-icon>
    <span>{{*simpleButtonText}}</span>
    <slot></slot>
  </button>
</lr-drop-area>
`;
