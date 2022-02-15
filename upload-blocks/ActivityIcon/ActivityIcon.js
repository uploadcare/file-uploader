import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ActivityIcon extends BlockComponent {
  init$ = {
    '*activityIcon': 'default',
  };
}

ActivityIcon.template = /* html */ `
<uc-icon set="@name: *activityIcon"></uc-icon>
`;
