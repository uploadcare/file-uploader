import { html } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import type { UploaderController } from '../abstract/controllers/UploaderController';
import type { LazyPluginEntry } from '../abstract/managers/plugin/LazyPluginLoader';
import svgIconsSprite from '../blocks/themes/uc-basic/svg-sprite';
import { ChildBlock } from './ChildBlock';

/**
 * v2 `ChildBlock`-based equivalent of `LitSolutionBlock` (v1). A solution tag
 * (`<uc-file-uploader-regular|minimal|inline>`, `<uc-cloud-image-editor>`)
 * extends this to get the same boot-time registrations `LitSolutionBlock`
 * performed in `initCallback`, re-run on every controller adoption
 * (`controllerReady` fires on initial adoption and on re-adoption, matching
 * v1's re-`initCallback`-on-reconnect behavior).
 */
export abstract class SolutionChildBlock extends ChildBlock {
  public static override styleAttrs = ['uc-wgt-common'];
  public static lazyPlugins: LazyPluginEntry[] | null = null;

  private _unregisterClipboardScope: (() => void) | null = null;

  protected override controllerReady(ctrl: UploaderController): void {
    super.controllerReady(ctrl);

    // Re-adoption safety (teardown-before-resubscribe, mirroring
    // Config/SolutionBlock): drop the previous cycle's clipboard scope before
    // registering a new one, so re-adoption doesn't stack two scopes.
    this._unregisterClipboardScope?.();
    this._unregisterClipboardScope = null;

    ctrl.a11y.registerBlock(this);
    this._unregisterClipboardScope = ctrl.clipboard.registerScope(this) ?? null;
    // A boot-time identity fact on the controller, not pub/sub state — read
    // lazily by telemetry as the payload's `component`.
    ctrl.setSolutionName(this.tagName);

    const entries = (this.constructor as typeof SolutionChildBlock).lazyPlugins;
    if (entries) {
      this.bag.ctx.pub('*lazyPlugins', entries);
    }
  }

  protected override controllerReleased(ctrl: UploaderController): void {
    super.controllerReleased(ctrl);
    // Drop our scope from the shared clipboard controller so a detached
    // element isn't retained until ctx teardown. `controllerReady` re-runs on
    // re-adoption and re-registers the scope. Note: v1 never unregisters the
    // a11y block in `disconnectedCallback` either — matched here (no paired
    // unregister exists on `A11y`).
    this._unregisterClipboardScope?.();
    this._unregisterClipboardScope = null;
  }

  public override render() {
    return html`${unsafeSVG(svgIconsSprite)}`;
  }
}
