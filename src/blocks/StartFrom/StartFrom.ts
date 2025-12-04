import './start-from.css';
import { html } from 'lit';
import { type ActivityType, LitActivityBlock } from '../../lit/LitActivityBlock';

export class StartFrom extends LitActivityBlock {
  override historyTracked = true;
  override activityType: ActivityType = LitActivityBlock.activities.START_FROM;

  override initCallback(): void {
    super.initCallback();
    this.registerActivity(this.activityType ?? '');
  }

  override render() {
    return html` <div class="uc-content">${this.yield('')}</div> `;
  }
}
