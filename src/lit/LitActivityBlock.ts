import { activityBlockCtx } from '../abstract/CTX';
import type { ActivityParams as CloudImageEditorActivityParams } from '../blocks/CloudImageEditorActivity/CloudImageEditorActivity';
import type { ActivityParams as ExternalSourceActivityParams } from '../blocks/ExternalSource/ExternalSource';

import { ACTIVITY_TYPES, type ActivityType, type RegisteredActivityType } from './activity-constants';
import { type ActivityCallbacks, ActivityController } from './controllers/activityController';
import { LitBlock } from './LitBlock';

export type ActivityParamsMap = {
  'cloud-image-edit': CloudImageEditorActivityParams;
  external: ExternalSourceActivityParams;
};

export class LitActivityBlock extends LitBlock {
  protected historyTracked = false;

  public override init$ = activityBlockCtx(this);

  private readonly _activityController: ActivityController;

  public constructor() {
    super();
    this._activityController = new ActivityController(this, {
      getHistoryTracked: () => this.historyTracked,
    });
  }

  // declare static activities to satisfy type references below
  public static activities: Readonly<{
    START_FROM: 'start-from';
    CAMERA: 'camera';
    DRAW: 'draw';
    UPLOAD_LIST: 'upload-list';
    URL: 'url';
    CLOUD_IMG_EDIT: 'cloud-image-edit';
    EXTERNAL: 'external';
  }>;

  protected get isActivityActive(): boolean {
    return this._activityController.active;
  }

  public get couldOpenActivity(): boolean {
    return true;
  }

  /** TODO: remove name argument */
  protected registerActivity(_name: string, options: ActivityCallbacks = {}): void {
    this._activityController.registerActivity(options);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  public get activityParams(): ActivityParamsMap[keyof ActivityParamsMap] {
    return this.sharedCtx.read('*currentActivityParams') as ActivityParamsMap[keyof ActivityParamsMap];
  }

  public get initActivity(): string | null {
    return (this.getCssData('--cfg-init-activity') as string | null) ?? null;
  }

  public get doneActivity(): string | null {
    return (this.getCssData('--cfg-done-activity') as string | null) ?? null;
  }

  public historyBack(): void {
    this._activityController.historyBack();
  }
}

LitActivityBlock.activities = ACTIVITY_TYPES;

export type { RegisteredActivityType, ActivityType };
