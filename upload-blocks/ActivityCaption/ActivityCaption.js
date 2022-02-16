import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ActivityCaption extends BlockComponent {
  init$ = {
    '*activityCaption': undefined,
  };
}

ActivityCaption.template = /* html */ `
<div class="caption">{{*activityCaption}}</div>
`;
