import { Block } from '../../abstract/Block.js';

/** @typedef {{ '*activityIcon': String }} State */

/** @extends {Block<State>} */
export class ActivityIcon extends Block {
  /** @type {State} */
  init$ = {
    '*activityIcon': 'default',
  };
}

ActivityIcon.template = /* html */ `
<lr-icon set="@name: *activityIcon"></lr-icon>
`;
