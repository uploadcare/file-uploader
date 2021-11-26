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
        // TODO: timeout fixes case with separate activity-caption and activity-icon components
        // they don't have time to initialize own state before this callback called first time
        setTimeout(() => this.onActivate(), 0);
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

  onActivate() {
    this.set$({
      '*modalDesiredWidth': window.getComputedStyle(this).getPropertyValue('--activity-desired-w'),
      '*modalDesiredHeight': window.getComputedStyle(this).getPropertyValue('--activity-desired-h'),
      '*modalDesiredMobileWidth': window.getComputedStyle(this).getPropertyValue('--activity-desired-mobile-w'),
      '*modalDesiredMobileHeight': window.getComputedStyle(this).getPropertyValue('--activity-desired-mobile-h'),
    });
  }
  onDeactivate() {}
}
