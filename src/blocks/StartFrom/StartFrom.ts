import './start-from.css';
import { html } from 'lit';
import { ActivityChildBlock } from '../../lit/ActivityChildBlock';
import { ACTIVITY_TYPES, type ActivityType } from '../../lit/activity-constants';

export class StartFrom extends ActivityChildBlock {
  public override activityType: ActivityType = ACTIVITY_TYPES.START_FROM;

  public override render() {
    return html` <div class="uc-content">${this.yield('')}</div> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-start-from': StartFrom;
  }
}
