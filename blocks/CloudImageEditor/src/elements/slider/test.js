import { Block } from '../../../../../abstract/Block.js';
import { registerBlocks } from '../../../../../abstract/registerBlocks.js';
import { SliderUi } from './SliderUi.js';

class CtxProvider extends Block {
  init$ = {
    min: 0,
    max: 100,
    defaultValue: 50,
    value: 50,
    'on.input': (value) => {
      this.$.value = value;
    },
  };
}

CtxProvider.template = /*html*/ `
  <uc-slider-ui set="min: min; max: max: defaultValue: defaultValue; onInput: on.input"></uc-slider-ui>
  <div>{{value}}</div>
`;

registerBlocks({ SliderUi, CtxProvider });
