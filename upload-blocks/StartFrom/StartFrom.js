import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class StartFrom extends BlockComponent {
  activityType = 'source-select';

  initCallback() {
    this.registerActivity(this.activityType, () => {
      this.set$({
        '*activityCaption': this.l10n('select-file-source'),
        '*activityIcon': 'default',
      });
    });
  }
}
