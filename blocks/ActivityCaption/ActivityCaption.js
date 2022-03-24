import { Block } from '../../abstract/Block.js';

export class ActivityCaption extends Block {
  init$ = {
    '*activityCaption': undefined,
  };
}

ActivityCaption.template = /* html */ `
<div class="caption">{{*activityCaption}}</div>
`;
