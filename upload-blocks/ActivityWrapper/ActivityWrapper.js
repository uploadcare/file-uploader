import { ActivityComponent } from '../ActivityComponent/ActivityComponent.js';

export class ActivityWrapper extends ActivityComponent {
  initCallback() {
    this.activityType = this.getAttribute('activity');

    super.initCallback();
  }
}
