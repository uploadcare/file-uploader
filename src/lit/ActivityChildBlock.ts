import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { ACTIVITY_TYPES, type ActivityParamsMap, type ActivityType } from '../abstract/activity-constants';
import { RouterController } from '../abstract/controllers/RouterController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { inject } from '../abstract/di/inject';
import { ChildBlock } from './ChildBlock';

const ACTIVE_ATTR = 'active';

/**
 * Base for activity blocks. A subclass
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
  /** @internal */
  @inject(RouterController) protected readonly _router!: RouterController;

  // Reactive, so a type that arrives after adoption (`PluginActivityHost`'s late registration) re-renders the block,
  // which then reads the router slots below and tracks them.
  @property({ attribute: false })
  public activityType: ActivityType = null;

  public static activities = ACTIVITY_TYPES;

  /** Un-report callback for the current `reportActivityMounted()` report, if any. */
  private _unreportActivityMounted?: () => void;

  protected override controllerReady(_container: ControllerContainer): void {
    super.controllerReady(_container);
    this._applyActivityType({ replaceAttribute: false });
  }

  // Updates run only while adopted, so the router is there to report to.
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('activityType')) {
      // A change from one type to another moves the attribute; a first type keeps one set by hand.
      this._applyActivityType({ replaceAttribute: changed.get('activityType') != null });
    }
  }

  private _applyActivityType({ replaceAttribute }: { replaceAttribute: boolean }): void {
    if (this.activityType && (replaceAttribute || !this.hasAttribute('activity'))) {
      this.setAttribute('activity', this.activityType);
    }
    this.reportActivityMounted();
  }

  /**
   * Report `this.activityType` as mounted with the router so API waits
   * (navigate/setModalState) can find it. Idempotent: releases any prior report first, so a
   * changed `activityType` moves the report from the old id to the new one.
   * A no-op (after releasing the prior report) when `activityType` is `null`.
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
    // either slot auto-re-runs this update.
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
