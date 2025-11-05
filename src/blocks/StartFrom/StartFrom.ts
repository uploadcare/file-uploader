import { html } from '@symbiotejs/symbiote';
import type { ActivityType } from '../../abstract/ActivityBlock';
import { ActivityBlock } from '../../abstract/ActivityBlock';
import './start-from.css';

export class StartFrom extends ActivityBlock {
  override historyTracked = true;
  override activityType: ActivityType = ActivityBlock.activities.START_FROM;

  override initCallback(): void {
    super.initCallback();
    this.registerActivity(this.activityType ?? '');
  }
}

StartFrom.template = html` <div class="uc-content"><slot></slot></div> `;
