import { Block } from '../../abstract/Block.js';

export class StartFrom extends Block {
  activityType = 'start-from';

  init$ = {
    '*activityCaption': '',
    '*activityIcon': '',
  };

  /** @private */
  __handleSingleSource() {
    window.setTimeout(() => {
      if (this.hasAttribute('active')) {
        if (this.sourceList?.length === 1) {
          let src = this.sourceList[0];
          if (src === 'local') {
            this.openSystemDialog();
            this.set$({
              '*currentActivity': Block.activities.UPLOAD_LIST,
            });
          } else {
            this.set$({
              '*currentActivity': src,
            });
          }
        }
      }
    });
  }

  initCallback() {
    super.initCallback();
    this.sub('*modalActive', (val) => {
      if (val) {
        this.__handleSingleSource();
      }
    });
    this.sub('*currentActivity', (val) => {
      if (val) {
        this.__handleSingleSource();
      }
    });
    this.registerActivity(this.activityType, () => {
      this.set$({
        '*activityCaption': this.l10n('select-file-source'),
        '*activityIcon': 'default',
      });
    });
  }
}
