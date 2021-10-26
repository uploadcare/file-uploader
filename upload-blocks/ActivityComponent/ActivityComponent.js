import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ActivityComponent extends BlockComponent {
  activityType = undefined;

  constructor() {
    super();

    this._isActive = false;
    this._activityParams = {};
  }

  initCallback() {
    this.sub('*currentActivity', (currentActivity) => {
      if (currentActivity === this.activityType && !this._isActive) {
        this._isActive = true;
        this.onActivate();
      } else if (currentActivity !== this.activityType && this._isActive) {
        this._isActive = false;
        this.onDeactivate();
      }
    });

    this.sub('*currentActivityParams', (currentActivityParams) => {
      this._activityParams = currentActivityParams;
    });
  }

  get activityParams() {
    return this._activityParams;
  }

  onActivate() {}
  onDeactivate() {}
}
