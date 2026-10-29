import { html } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { AppInfo } from '../abstract/controllers/AppInfo';
import { LazyPluginsController } from '../abstract/controllers/LazyPluginsController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import type { LazyPluginEntry } from '../abstract/managers/plugin/LazyPluginLoader';
import svgIconsSprite from '../blocks/themes/uc-basic/svg-sprite';
import { A11y } from './a11y';
import { ChildBlock } from './ChildBlock';
import { ClipboardController } from './ClipboardController';
import { ensureUploaderScope } from './ensureUploaderScope';

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
  /**
   * Whether the solution is an uploader: its adoption attaches the upload stack, rather than leaving that to whichever
   * `<uc-drop-area>` its template happens to render first.
   */
  public static isUploader = false;
  /** Whether the solution shows its activities in a modal. */
  public static hasModal = true;
  /** Whether a paste anywhere on the page adds files while the solution sits on its start screen (`pasteScope: 'global'`). */
  public static ownsPagePaste = false;

  protected override controllerReady(container: ControllerContainer): void {
    super.controllerReady(container);

    // Register this host's DOM scope with the per-ctx window-listener
    // aggregators — `ClipboardController` (`paste`) and `A11y`
    // (`keydown`/`keyup`). `addDisposer` drains both on release, which covers a
    // plain disconnect and an in-place `ctx-name` switch, and a re-adoption
    // registers afresh instead of stacking.
    const solution = this.constructor as typeof SolutionChildBlock;
    const clipboard = container.get(ClipboardController);
    const a11y = container.get(A11y);
    this.addDisposer(clipboard.registerScope(this, { ownsPagePaste: solution.ownsPagePaste }));
    this.addDisposer(a11y.registerBlock(this));

    // A boot-time identity fact on the container-owned `AppInfo`, not pub/sub
    // state — read lazily by telemetry as the payload's `component`.
    container.get(AppInfo).setSolutionName(this.tagName);
    container.get(AppInfo).setHasModal(solution.hasModal);
    if (solution.isUploader) {
      ensureUploaderScope(container);
    }

    const entries = solution.lazyPlugins;
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
