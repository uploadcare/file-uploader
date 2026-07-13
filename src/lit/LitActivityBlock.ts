import type { PropertyValues } from 'lit';
import { activityBlockCtx } from '../abstract/CTX';
import { ACTIVITY_TYPES, type ActivityParamsMap, type ActivityType } from './activity-constants';
import { LitBlock } from './LitBlock';

const ACTIVE_ATTR = 'active';

/**
 * Base for activity blocks. A subclass declares its `activityType`; the base
 * reflects the `[active]` attribute whenever this block owns its slot, and
 * re-renders on every router transition.
 *
 * Slot is chosen by DOM location: a block inside a `<uc-modal>` tracks the
 * foreground slot (`router.modal`); an inline block tracks the background slot
 * (`router.activity`). This lets minimal's two `<uc-start-from>` elements (same
 * `activityType`, different DOM scopes) light up under different conditions.
 * History and the `activity-change` event are owned by the `RouterController`.
 */
export class LitActivityBlock extends LitBlock {
  public activityType: ActivityType = null;

  public override init$ = activityBlockCtx();

  public override initCallback(): void {
    super.initCallback();

    // Only blocks that actually represent an activity react to the router.
    // Many `LitActivityBlock`/`LitUploaderBlock` subclasses (source buttons,
    // source list, headers, …) have no `activityType` and would otherwise
    // re-render on every navigation for nothing.
    if (!this.activityType) {
      return;
    }
    // TODO: rename activityType to activityId
    if (!this.hasAttribute('activity')) {
      this.setAttribute('activity', this.activityType);
    }
    // Re-render on every router transition so `updated()` re-evaluates the slot.
    this.subRouter(() => this.requestUpdate());
  }

  /** Whether this block's activity currently owns its slot. */
  protected get isActivityActive(): boolean {
    if (!this.activityType) {
      return false;
    }
    const isInModal = this.closest('uc-modal') !== null;
    const slot = isInModal ? this.router.modal : this.router.activity;
    return slot === this.activityType;
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (this.activityType) {
      this.toggleAttribute(ACTIVE_ATTR, this.isActivityActive);
    }
  }

  // declare static activities to satisfy type references below
  public static activities: Readonly<{
    START_FROM: 'start-from';
    CAMERA: 'camera';
    UPLOAD_LIST: 'upload-list';
    URL: 'url';
    CLOUD_IMG_EDIT: 'cloud-image-edit';
    EXTERNAL: 'external';
  }>;

  public get activityParams(): ActivityParamsMap[keyof ActivityParamsMap] {
    return this.router.params as ActivityParamsMap[keyof ActivityParamsMap];
  }
}

LitActivityBlock.activities = ACTIVITY_TYPES;
