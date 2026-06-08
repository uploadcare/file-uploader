import type { PropertyValueMap } from 'lit';
import type { UploaderController } from '../abstract/controllers/UploaderController';
import { ChildBlock } from './ChildBlock';

/**
 * v2 base for activity blocks. Subclasses declare `activityType`; the
 * base toggles the `[active]` attribute on the host when the router's
 * current activity matches, and re-renders on router transitions.
 */
export abstract class ActivityBlock extends ChildBlock {
  /** Subclass-declared activity id. */
  public abstract activityType: string;

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [ctrl.router.subscribe.bind(ctrl.router), ctrl.locale.subscribe.bind(ctrl.locale)];
  }

  public override updated(_changed: Map<PropertyKey, unknown> | PropertyValueMap<unknown>): void {
    const router = this.uploaderOrNull?.router;
    // Each ActivityBlock belongs to exactly one slot based on its DOM
    // location: blocks rendered inside a `<uc-modal>` track the
    // foreground (`router.modal`); the inline ones track the background
    // (`router.activity`). Minimal's two `<uc-start-from>` elements
    // share an `activityType` but live in different DOM scopes, so they
    // light up under different conditions.
    const isInModal = this.closest('uc-modal') !== null;
    const slot = isInModal ? router?.modal : router?.activity;
    const active = slot === this.activityType;
    this.toggleAttribute('active', active);
    // Mirror v1's `[activity="..."]` styleAttr so v1-era CSS rules
    // (per-activity modal sizing, etc.) match.
    if (this.getAttribute('activity') !== this.activityType) {
      this.setAttribute('activity', this.activityType);
    }
  }
}
