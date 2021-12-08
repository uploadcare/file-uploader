import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class StartFrom extends BlockComponent {
  activityType = 'source-select';

  initCallback() {
    this.registerActivity(this.activityType, () => {
      this.set$({
        '*modalCaption': this.l10n('select-file-source'),
        '*modalIcon': 'default',
      });
    });
  }
}
