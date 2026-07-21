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

  // Per-host scope registrations with the shared per-ctx `ClipboardController`
  // (`paste`) and `A11y` (`keydown`/`keyup`) window-listener aggregators, driven
  // by `HostScopeController`. Created in `controllerReady` (where the container
  // resolves the aggregators) and torn down in `controllerReleased`.
  private _clipboardScope: HostScopeController | null = null;
  private _a11yScope: HostScopeController | null = null;

  protected override controllerReady(container: ControllerContainer): void {
    super.controllerReady(container);

    // Re-adoption safety (teardown-before-resubscribe): drop the previous
    // cycle's scopes before registering new ones, so re-adoption doesn't stack.
    this._teardownScopes();

    const clipboard = container.get(ClipboardController);
    this._clipboardScope = new HostScopeController(this, () => clipboard.registerScope(this));

    const a11y = container.get(A11y);
    this._a11yScope = new HostScopeController(this, () => {
      a11y.registerBlock(this);
      return () => a11y.unregisterBlock(this);
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

  protected override controllerReleased(container: ControllerContainer): void {
    super.controllerReleased(container);
    // Drop our scopes from the shared aggregators so a detached element isn't
    // retained until ctx teardown; `controllerReady` re-registers on re-adoption.
    this._teardownScopes();
  }

  private _teardownScopes(): void {
    for (const scope of [this._clipboardScope, this._a11yScope]) {
      if (scope) {
        scope.hostDisconnected();
        this.removeController(scope);
      }
    }
    this._clipboardScope = null;
    this._a11yScope = null;
  }

  public override render() {
    return html`${unsafeSVG(svgIconsSprite)}`;
  }
}
