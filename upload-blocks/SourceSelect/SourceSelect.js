import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { ActivityComponent } from '../ActivityComponent/ActivityComponent.js';

export class SourceSelect extends ActivityComponent {
  activityType = BlockComponent.activities.SOURCE_SELECT;

  onActivate() {
    super.onActivate();

    this.set$({
      '*modalCaption': this.l10n('select-file-source'),
      '*modalIcon': 'default',
      '*modalActive': true,
    });
  }
}

SourceSelect.template = /*html*/ `
<slot></slot>
`;
