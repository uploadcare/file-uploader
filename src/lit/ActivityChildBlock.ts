import type { PropertyValues } from 'lit';
import { RouterController } from '../abstract/controllers/RouterController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { inject } from '../abstract/di/inject';
import { ACTIVITY_TYPES, type ActivityParamsMap, type ActivityType } from './activity-constants';
import { ChildBlock } from './ChildBlock';
import { subscription, type Unsubscribe } from './subscription';

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
  // The base's `[active]` toggle (and every activity block's navigation) reads
  // the ctx's `RouterController`. `protected` so subclasses (`UploadList`,
  // `CloudImageEditorActivity`, `PluginActivityHost`) reuse this one inherited
  // `@inject` field instead of redeclaring their own (a duplicate private name
  // across the hierarchy would not type-check).
  @inject(RouterController) protected readonly _router!: RouterController;

  public activityType: ActivityType = null;

  public static activities = ACTIVITY_TYPES;

  /** Un-report callback for the current `reportActivityMounted()` report, if any. */
  private _unreportActivityMounted?: () => void;

  protected override controllerReady(_container: ControllerContainer): void {
    this.requestUpdate();
    if (!this.activityType) {
      return;
    }
    if (!this.hasAttribute('activity')) {
      this.setAttribute('activity', this.activityType);
    }
    this.reportActivityMounted();
  }

  // Re-render on every router transition so `updated()` re-evaluates the
  // `[active]` host attribute. Both slots `isActivityActive` reads —
  // `router.modal` AND `router.activity` — are now `@signalState`-backed, so once
  // a block with a real `activityType` has rendered, those tracked reads re-run
  // the update on their own — the coarse `router.subscribe` below would only add
  // redundant renders for it. So it is GATED to the null-`activityType` case: a
  // `PluginActivityHost` whose `.registration` arrives later adopts with
  // `activityType === null`, so `isActivityActive` early-returns BEFORE reading
  // any router signal — nothing is tracked, and without this subscription the
  // host would have no router wake-up to re-render once it syncs a real
  // activityType. A block already adopting with a real `activityType` skips the
  // subscription entirely; preserves the v1 `subRouter(() =>
  // this.requestUpdate())` timing only for the case that still needs it.
  @subscription()
  protected _wireActivityRerender(): Unsubscribe | void {
    if (this.activityType) {
      return;
    }
    return this._router.subscribe(() => this.requestUpdate());
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
    this._unreportActivityMounted = this._router.activityBlockMounted(this.activityType);
  }

  // The activity-mounted report is released in `controllerReleased`, which the
  // base's `disconnectedCallback` → `_releaseController` already invokes on
  // disconnect (and on ctx release/re-adoption). No separate `disconnectedCallback`
  // override is needed: the report is only ever set from `controllerReady` (it
  // needs the adopted `_router`), so a disconnect with no adopted container has
  // nothing to release.
  protected override controllerReleased(container: ControllerContainer): void {
    super.controllerReleased(container);
    this._unreportActivityMounted?.();
    this._unreportActivityMounted = undefined;
  }

  /** Whether this block's activity currently owns its slot. */
  protected get isActivityActive(): boolean {
    if (!this.activityType) {
      return false;
    }
    const router = this._router;
    const isInModal = this.closest('uc-modal') !== null;
    // Both `router.modal` and `router.activity` are tracked signals (read here
    // under `SignalWatcher` when `updated()` calls in), so a transition in
    // either slot auto-re-runs this update. The coarse `_wireActivityRerender`
    // subscription remains only for the null-`activityType` host (see its note).
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
    return this._router.params as ActivityParamsMap[keyof ActivityParamsMap];
  }
}
