import { html } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { AppInfo } from '../abstract/controllers/AppInfo';
import { ClipboardController } from '../abstract/controllers/ClipboardController';
import { LazyPluginsController } from '../abstract/controllers/LazyPluginsController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { A11y } from '../abstract/managers/a11y';
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

  protected override controllerReady(container: ControllerContainer): void {
    super.controllerReady(container);

    // Re-adoption safety (teardown-before-resubscribe, mirroring
    // Config/SolutionBlock): drop the previous cycle's clipboard scope before
    // registering a new one, so re-adoption doesn't stack two scopes.
    this._unregisterClipboardScope?.();
    this._unregisterClipboardScope = null;

    container.get(A11y).registerBlock(this);
    this._unregisterClipboardScope = container.get(ClipboardController).registerScope(this) ?? null;
    // A boot-time identity fact on the container-owned `AppInfo`, not pub/sub
    // state — read lazily by telemetry as the payload's `component`.
    container.get(AppInfo).setSolutionName(this.tagName);

    const entries = (this.constructor as typeof SolutionChildBlock).lazyPlugins;
    if (entries) {
      // `LazyPluginsController` owns the `*lazyPlugins` key (M-god step 4); this
      // is the same instance `LazyPluginLoader` reads, so publishing here still
      // triggers the loader (previously `bag.ctx.pub('*lazyPlugins', entries)`).
      container.get(LazyPluginsController).set(entries);
    }
  }

  protected override controllerReleased(container: ControllerContainer): void {
    super.controllerReleased(container);
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
