import './start-from.css';
import { html } from 'lit';
import { ACTIVITY_TYPES, type ActivityType } from '../../lit/activity-constants';
import { LitActivityBlock } from '../../lit/LitActivityBlock';

export class StartFrom extends LitActivityBlock {
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
