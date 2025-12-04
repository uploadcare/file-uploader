import { activityBlockCtx } from '../abstract/CTX';
import type { ActivityParams as CloudImageEditorActivityParams } from '../blocks/CloudImageEditorActivity/CloudImageEditorActivity';
import type { ActivityParams as ExternalSourceActivityParams } from '../blocks/ExternalSource/ExternalSource';
import { EventType } from '../blocks/UploadCtxProvider/EventEmitter';
import { debounce } from '../utils/debounce';
import { LitBlock } from './LitBlock';

const ACTIVE_ATTR = 'active';
const ACTIVE_PROP = '___ACTIVITY_IS_ACTIVE___';

export type ActivityParamsMap = {
  'cloud-image-edit': CloudImageEditorActivityParams;
  external: ExternalSourceActivityParams;
};

export class LitActivityBlock extends LitBlock {
  protected historyTracked = false;

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: accessed via computed property symbol
  private [ACTIVE_PROP]?: boolean;

  override init$ = activityBlockCtx(this);

  _debouncedHistoryFlush = debounce(this._historyFlush.bind(this), 10);

  private _deactivate(): void {
    const actDesc = LitActivityBlock._activityCallbacks.get(this);
    this[ACTIVE_PROP] = false;
    this.removeAttribute(ACTIVE_ATTR);
    actDesc?.deactivateCallback?.();
  }

  private _activate(): void {
    const actDesc = LitActivityBlock._activityCallbacks.get(this);
    this.$['*historyBack'] = this.historyBack.bind(this);
    this[ACTIVE_PROP] = true;
    this.setAttribute(ACTIVE_ATTR, '');
    actDesc?.activateCallback?.();

    this._debouncedHistoryFlush();

    this.emit(EventType.ACTIVITY_CHANGE, {
      activity: this.activityType,
    });
  }

  // must match visibility of base class
  override initCallback(): void {
    super.initCallback();

    // TODO: rename activityType to activityId
    if (this.activityType) {
      if (!this.hasAttribute('activity')) {
        this.setAttribute('activity', this.activityType);
      }
      this.sub('*currentActivity', (val: string | null) => {
        try {
          if (this.activityType !== val && this[ACTIVE_PROP]) {
            this._deactivate();
          } else if (this.activityType === val && !this[ACTIVE_PROP]) {
            this._activate();
          }
        } catch (err) {
          this.telemetryManager.sendEventError(err, `activity "${this.activityType}"`);
          console.error(`Error in activity "${this.activityType}". `, err);
          this.$['*currentActivity'] = this.$['*history'][this.$['*history'].length - 1] ?? null;
        }

        if (!val) {
          this.$['*history'] = [];
        }
      });
    }
  }

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: invoked via the debounced history flush helper
  private _historyFlush(): void {
    let history = this.$['*history'];
    if (history) {
      if (history.length > 10) {
        history = history.slice(history.length - 11, history.length - 1);
      }
      if (this.historyTracked && history[history.length - 1] !== this.activityType) {
        history.push(this.activityType);
      }
      this.$['*history'] = history;
    }
  }

  private _isActivityRegistered(): boolean {
    return !!this.activityType && LitActivityBlock._activityCallbacks.has(this);
  }

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: accessed through registerActivity/unregisterActivity
  private static _activityCallbacks: Map<
    LitActivityBlock,
    {
      activateCallback?: (() => void) | undefined;
      deactivateCallback?: (() => void) | undefined;
    }
  > = new Map();

  // declare static activities to satisfy type references below
  static activities: Readonly<{
    START_FROM: 'start-from';
    CAMERA: 'camera';
    DRAW: 'draw';
    UPLOAD_LIST: 'upload-list';
    URL: 'url';
    CLOUD_IMG_EDIT: 'cloud-image-edit';
    EXTERNAL: 'external';
  }>;

  get isActivityActive(): boolean {
    return !!this[ACTIVE_PROP];
  }

  get couldOpenActivity(): boolean {
    return true;
  }

  /** TODO: remove name argument */
  registerActivity(_name: string, options: { onActivate?: () => void; onDeactivate?: () => void } = {}): void {
    const { onActivate, onDeactivate } = options;
    LitActivityBlock._activityCallbacks.set(this, {
      activateCallback: onActivate,
      deactivateCallback: onDeactivate,
    });
  }

  unregisterActivity(): void {
    if (this.isActivityActive) {
      this._deactivate();
    }
    LitActivityBlock._activityCallbacks.delete(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._isActivityRegistered() && this.unregisterActivity();

    const currentActivity = this.$['*currentActivity'] as string | null;

    if (this.blocksRegistry) {
      const hasCurrentActivityInCtx = !![...this.blocksRegistry].find(
        (block) => block instanceof LitActivityBlock && block.activityType === currentActivity,
      );

      if (!hasCurrentActivityInCtx) {
        this.$['*currentActivity'] = null;
        this.modalManager?.closeAll();
      }
    }
  }

  get activityKey(): string {
    return this.ctxName + this.activityType;
  }

  get activityParams(): ActivityParamsMap[keyof ActivityParamsMap] {
    return this.$['*currentActivityParams'] as ActivityParamsMap[keyof ActivityParamsMap];
  }

  get initActivity(): string | null {
    return (this.getCssData('--cfg-init-activity') as string | null) ?? null;
  }

  get doneActivity(): string | null {
    return (this.getCssData('--cfg-done-activity') as string | null) ?? null;
  }

  historyBack(): void {
    const history = this.$['*history'] as string[];

    if (history) {
      let nextActivity = history.pop();

      while (nextActivity === this.activityType) {
        nextActivity = history.pop();
      }

      let couldOpenActivity = !!nextActivity;
      if (nextActivity) {
        const nextLitActivityBlock = [...this.blocksRegistry].find((block) => block.activityType === nextActivity);
        couldOpenActivity = (nextLitActivityBlock as LitActivityBlock | undefined)?.couldOpenActivity ?? false;
      }

      nextActivity = couldOpenActivity ? nextActivity : undefined;

      if (nextActivity) this.modalManager?.open(nextActivity);

      this.$['*currentActivity'] = nextActivity ?? null;
      this.$['*history'] = history;

      if (!nextActivity) {
        this.modalManager?.closeAll();
      }
    }
  }
}

LitActivityBlock.activities = Object.freeze({
  START_FROM: 'start-from',
  CAMERA: 'camera',
  DRAW: 'draw',
  UPLOAD_LIST: 'upload-list',
  URL: 'url',
  CLOUD_IMG_EDIT: 'cloud-image-edit',
  EXTERNAL: 'external',
});

export type RegisteredActivityType =
  (typeof LitActivityBlock)['activities'][keyof (typeof LitActivityBlock)['activities']];
export type ActivityType = RegisteredActivityType | (string & {}) | null;
