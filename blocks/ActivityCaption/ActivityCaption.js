import { Block } from '../../abstract/Block.js';

/** @typedef {{ '*activityCaption': String }} State */

/** @extends {Block<State>} */
export class ActivityCaption extends Block {
  /** @type {State} */
  init$ = {
    '*activityCaption': undefined,
  };
}

ActivityCaption.template = /* html */ `
<div class="caption">{{*activityCaption}}</div>
`;
