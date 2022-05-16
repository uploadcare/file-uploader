import { Block } from '../../abstract/Block.js';

/** @extends {Block<import('../ActivityCaption/ActivityCaption').State & import('../ActivityIcon/ActivityIcon').State>} */
export class StartFrom extends Block {
  activityType = 'start-from';

  initCallback() {
    super.initCallback();
    this.registerActivity(this.activityType, () => {
      this.set$({
        '*activityCaption': this.l10n('select-file-source'),
        '*activityIcon': 'default',
      });
    });
  }
}
