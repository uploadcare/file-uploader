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
import { HostScopeController } from './HostScopeController';

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

  protected override controllerReady(container: ControllerContainer): void {
    super.controllerReady(container);

    // A single per-host `HostScopeController` registers this host's DOM scope
    // with BOTH shared per-ctx window-listener aggregators — `ClipboardController`
    // (`paste`) and `A11y` (`keydown`/`keyup`) — on `hostConnected`, returning
    // one combined unregister (each aggregator hands back its own disposer). Its
    // teardown is `addDisposer`'d so `ChildBlock` drains it on release: that
    // covers a plain disconnect AND an in-place `ctx-name` switch (which releases
    // while `isConnected` stays true, so Lit's own `hostDisconnected` never
    // fires), and stops a re-adoption from stacking a second registration.
    const clipboard = container.get(ClipboardController);
    const a11y = container.get(A11y);
    const scope = new HostScopeController(this, () => {
      const unregisterClipboard = clipboard.registerScope(this);
      const unregisterA11y = a11y.registerBlock(this);
      return () => {
        unregisterClipboard();
        unregisterA11y();
      };
    });
    this.addDisposer(() => {
      scope.hostDisconnected();
      this.removeController(scope);
    });

    // A boot-time identity fact on the container-owned `AppInfo`, not pub/sub
    // state — read lazily by telemetry as the payload's `component`.
    container.get(AppInfo).setSolutionName(this.tagName);

    const entries = (this.constructor as typeof SolutionChildBlock).lazyPlugins;
    if (entries) {
      // `LazyPluginsController` owns the lazy-plugin entries (M-god step 4); this
      // is the same instance `LazyPluginLoader` reads + subscribes to, so setting
      // them here triggers the loader.
      container.get(LazyPluginsController).set(entries);
    }
  }

  public override render() {
    return html`${unsafeSVG(svgIconsSprite)}`;
  }
}
