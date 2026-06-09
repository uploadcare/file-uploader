import { activityBlockCtx } from '../abstract/CTX';
import type { ActivityParams as CloudImageEditorActivityParams } from '../blocks/CloudImageEditorActivity/CloudImageEditorActivity';
import type { ActivityParams as ExternalSourceActivityParams } from '../blocks/ExternalSource/ExternalSource';
import {
  ACTIVITY_TYPES,
  type ActivityType,
  type CustomActivities,
  type RegisteredActivityType,
} from './activity-constants';
import { LitBlock } from './LitBlock';

const ACTIVE_ATTR = 'active';
const ACTIVE_PROP = '___ACTIVITY_IS_ACTIVE___';

export type ActivityParamsMap = {
  'cloud-image-edit': CloudImageEditorActivityParams;
  external: ExternalSourceActivityParams;
} & {
  [Key in keyof CustomActivities]: CustomActivities[Key]['params'];
};

export class LitActivityBlock extends LitBlock {
  public activityType: ActivityType = null;

  private [ACTIVE_PROP]?: boolean;

  public override init$ = activityBlockCtx(this);

  private _deactivate(): void {
    const actDesc = LitActivityBlock._activityCallbacks.get(this);
    this[ACTIVE_PROP] = false;
    this.removeAttribute(ACTIVE_ATTR);
    actDesc?.deactivateCallback?.();
  }

  private _activate(): void {
    const actDesc = LitActivityBlock._activityCallbacks.get(this);
    this[ACTIVE_PROP] = true;
    this.setAttribute(ACTIVE_ATTR, '');
    actDesc?.activateCallback?.();
  }

  // must match visibility of base class
  public override initCallback(): void {
    super.initCallback();

    // TODO: rename activityType to activityId
    if (this.activityType) {
      if (!this.hasAttribute('activity')) {
        this.setAttribute('activity', this.activityType);
      }
      // v2 composition: a block picks its slot by DOM location. Blocks inside a
      // `<uc-modal>` track the foreground slot (`router.modal`); inline blocks
      // track the background slot (`router.activity`). This lets minimal's two
      // `<uc-start-from>` elements (same `activityType`, different DOM scopes)
      // light up under different conditions. History and the `activity-change`
      // event are owned by the RouterController.
      this.subRouter(() => {
        const isInModal = this.closest('uc-modal') !== null;
        const slot = isInModal ? this.router.modal : this.router.activity;
        const shouldBeActive = slot === this.activityType;
        try {
          if (!shouldBeActive && this[ACTIVE_PROP]) {
            this._deactivate();
          } else if (shouldBeActive && !this[ACTIVE_PROP]) {
            this._activate();
          }
        } catch (err) {
          this.telemetryManager.sendEventError(err, `activity "${this.activityType}"`);
          console.error(`Error in activity "${this.activityType}". `, err);
          this.router.back();
        }
      });
    }
  }

  protected _isActivityRegistered(): boolean {
    return !!this.activityType && LitActivityBlock._activityCallbacks.has(this);
  }

  private static _activityCallbacks: Map<
    LitActivityBlock,
    {
      activateCallback?: (() => void) | undefined;
      deactivateCallback?: (() => void) | undefined;
    }
  > = new Map();

  // declare static activities to satisfy type references below
  public static activities: Readonly<{
    START_FROM: 'start-from';
    CAMERA: 'camera';
    UPLOAD_LIST: 'upload-list';
    URL: 'url';
    CLOUD_IMG_EDIT: 'cloud-image-edit';
    EXTERNAL: 'external';
  }>;

  protected get isActivityActive(): boolean {
    return !!this[ACTIVE_PROP];
  }

  public get couldOpenActivity(): boolean {
    return true;
  }

  /** TODO: remove name argument */
  protected registerActivity(
    _name: string,
    options: { onActivate?: () => void; onDeactivate?: () => void } = {},
  ): void {
    const { onActivate, onDeactivate } = options;
    LitActivityBlock._activityCallbacks.set(this, {
      activateCallback: onActivate,
      deactivateCallback: onDeactivate,
    });
  }

  private _unregisterActivity(): void {
    if (this.isActivityActive) {
      this._deactivate();
    }
    LitActivityBlock._activityCallbacks.delete(this);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._isActivityRegistered() && this._unregisterActivity();
  }

  public get activityParams(): ActivityParamsMap[keyof ActivityParamsMap] {
    return this.router.params as ActivityParamsMap[keyof ActivityParamsMap];
  }

  public get initActivity(): RegisteredActivityType | null {
    return (this.getCssData('--cfg-init-activity') as RegisteredActivityType | null) ?? null;
  }

  public get doneActivity(): RegisteredActivityType | null {
    return (this.getCssData('--cfg-done-activity') as RegisteredActivityType | null) ?? null;
  }

  public historyBack(): void {
    this.router.back();
  }
}

LitActivityBlock.activities = ACTIVITY_TYPES;

export type { RegisteredActivityType, ActivityType, CustomActivities };
