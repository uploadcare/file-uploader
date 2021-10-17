import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ActivityWrapper extends BlockComponent {
  initCallback() {
    this.activityType = this.getAttribute('activity');
  }
}
