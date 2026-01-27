import './start-from.css';
import { html } from 'lit';
import { type ActivityType, LitActivityBlock } from '../../lit/LitActivityBlock';

export class StartFrom extends LitActivityBlock {
  protected override historyTracked = true;
  public override activityType: ActivityType = LitActivityBlock.activities.START_FROM;

  public override initCallback(): void {
    super.initCallback();
    this.registerActivity(this.activityType ?? '');
  }

  public override render() {
    return html` <div class="uc-content">${this.yield('')}</div> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-start-from': StartFrom;
  }
}
