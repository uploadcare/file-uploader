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
  // `[active]` host attribute. Wired unconditionally, even when `activityType`
  // is still null at adoption (e.g. a `PluginActivityHost` whose `.registration`
  // arrives later) — otherwise a host that later syncs a real activityType would
  // have no router subscription and never re-render. Harmless extra re-renders
  // for a null-activity host meanwhile.
  //
  // Deliberately a COARSE `router.subscribe`, not a tracked signal read: the
  // background-slot branch of `isActivityActive` reads `router.activity`, which
  // is NOT signal-backed (only `router.modal`/`router.currentActivity` are), so
  // a background transition under an open modal would not re-track and the toggle
  // would go stale. The coarse subscription fires on every transition (both
  // slots), preserving the v1 `subRouter(() => this.requestUpdate())` timing.
  @subscription()
  protected _wireActivityRerender(): Unsubscribe {
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

  protected override controllerReleased(container: ControllerContainer): void {
    super.controllerReleased(container);
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
    const router = this._router;
    const isInModal = this.closest('uc-modal') !== null;
    // `router.modal` is a tracked signal (read here under `SignalWatcher` when
    // `updated()` calls in); `router.activity` is a plain field — the coarse
    // subscription wired in `controllerReady` is what re-runs the update for a
    // background-slot change (see the note there).
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
