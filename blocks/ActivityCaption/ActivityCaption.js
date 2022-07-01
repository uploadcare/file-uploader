import { ActivityBlock } from '../../abstract/ActivityBlock.js';

export class ActivityCaption extends ActivityBlock {
  init$ = {
    ...this.init$,
    '*activityCaption': undefined,
  };
}

ActivityCaption.template = /* html */ `
<div class="caption">{{*activityCaption}}</div>
`;
