import { Block } from '../../abstract/Block.js';

export class ActivityIcon extends Block {
  init$ = {
    '*activityIcon': 'default',
  };
}

ActivityIcon.template = /* html */ `
<uc-icon set="@name: *activityIcon"></uc-icon>
`;
