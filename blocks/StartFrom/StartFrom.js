import { ActivityBlock } from '../../abstract/ActivityBlock.js';

export class StartFrom extends ActivityBlock {
  historyTracked = true;
  /** @type {import('../../abstract/ActivityBlock.js').ActivityType} */
  activityType = 'start-from';

  initCallback() {
    super.initCallback();
    this.registerActivity(this.activityType);
  }
}

StartFrom.template = /* HTML */ ` <div class="uc-content"><slot></slot></div> `;
