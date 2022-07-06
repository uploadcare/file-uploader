import { ActivityBlock } from '../../abstract/ActivityBlock.js';

export class ActivityIcon extends ActivityBlock {
  init$ = {
    ...this.init$,
    '*activityIcon': 'default',
  };
}

ActivityIcon.template = /* html */ `
<lr-icon set="@name: *activityIcon"></lr-icon>
`;
