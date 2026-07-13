import type { PropertyValues } from 'lit';
import type { UploaderController } from '../abstract/controllers/UploaderController';
import { ACTIVITY_TYPES, type ActivityParamsMap, type ActivityType } from './activity-constants';
import { ChildBlock } from './ChildBlock';

const ACTIVE_ATTR = 'active';

/**
 * Base for activity blocks ported off `LitActivityBlock` (M9). A subclass
 * declares its `activityType`; the base reflects the `activity` attribute and
 * toggles `[active]` whenever the block's slot owns the current transition.
 * Slot is chosen by DOM location: inside `<uc-modal>` tracks the foreground
 * slot (`router.modal`), otherwise the background slot (`router.activity`).
 * Subclasses overriding `controllerReady` MUST call `super.controllerReady(ctrl)`.
 */
export class ActivityChildBlock extends ChildBlock {
  public activityType: ActivityType = null;

  public static activities = ACTIVITY_TYPES;

  /** Un-report callback for the current `reportActivityMounted()` report, if any. */
  private _unreportActivityMounted?: () => void;

  protected override controllerReady(_ctrl: UploaderController): void {
    if (!this.activityType) {
      return;
    }
    if (!this.hasAttribute('activity')) {
      this.setAttribute('activity', this.activityType);
    }
    // Re-render on every router transition so `updated()` re-evaluates the slot.
    this.subRouter(() => this.requestUpdate());
    this.reportActivityMounted();
  }

  /**
   * Report `this.activityType` as mounted with the router so API waits
   * (navigate/setModalState) can find it now that ported blocks are not in
   * `*blocksRegistry`. Idempotent: releases any prior report first, so it's
   * safe to call again after `activityType` changes post-adoption (e.g.
   * `PluginActivityHost`'s late-registration sync) to move the report from
   * the old id to the new one. A no-op (after releasing the prior report)
   * when `activityType` is `null`.
   */
  protected reportActivityMounted(): void {
    this._unreportActivityMounted?.();
    this._unreportActivityMounted = undefined;
    if (!this.activityType) {
      return;
    }
    this._unreportActivityMounted = this.bag.router.activityBlockMounted(this.activityType);
  }

  protected override controllerReleased(ctrl: UploaderController): void {
    super.controllerReleased(ctrl);
    this._unreportActivityMounted?.();
    this._unreportActivityMounted = undefined;
  }

  public override disconnectedCallback(): void {
    this._unreportActivityMounted?.();
    this._unreportActivityMounted = undefined;
    super.disconnectedCallback();
  }

  /** Whether this block's activity currently owns its slot. */
  protected get isActivityActive(): boolean {
    if (!this.activityType) {
      return false;
    }
    const router = this.bag.router;
    const isInModal = this.closest('uc-modal') !== null;
    const slot = isInModal ? router.modal : router.activity;
    return slot === this.activityType;
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (this.activityType) {
      this.toggleAttribute(ACTIVE_ATTR, this.isActivityActive);
    }
  }

  public get activityParams(): ActivityParamsMap[keyof ActivityParamsMap] {
    return this.bag.router.params as ActivityParamsMap[keyof ActivityParamsMap];
  }
}
