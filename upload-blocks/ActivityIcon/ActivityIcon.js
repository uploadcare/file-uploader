import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ActivityIcon extends BlockComponent {
  init$ = {
    '*modalIcon': 'default',
  };
}

ActivityIcon.template = /* html */ `
<uc-icon set="@name: *modalIcon"></uc-icon>
`;
