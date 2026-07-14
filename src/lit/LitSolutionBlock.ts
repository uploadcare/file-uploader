import { html } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { solutionBlockCtx } from '../abstract/CTX';
import type { LazyPluginEntry } from '../abstract/managers/plugin/LazyPluginLoader';
import svgIconsSprite from '../blocks/themes/uc-basic/svg-sprite';
import { LitBlock } from './LitBlock';

export class LitSolutionBlock extends LitBlock {
  public static override styleAttrs = ['uc-wgt-common'];
  public static lazyPlugins: LazyPluginEntry[] | null = null;
  public override init$ = solutionBlockCtx();

  private _unregisterClipboardScope: (() => void) | null = null;

  public override initCallback(): void {
    super.initCallback();
    this.a11y?.registerBlock(this);
    this._unregisterClipboardScope = this.clipboardLayer?.registerScope(this) ?? null;
    // A boot-time identity fact on the controller, not pub/sub state — read
    // lazily by telemetry as the payload's `component`.
    this.sharedCtx.uploaderController().setSolutionName(this.tagName);
    const entries = (this.constructor as typeof LitSolutionBlock).lazyPlugins;
    if (entries) {
      this.sharedCtx.pub('*lazyPlugins', entries);
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Drop our scope from the shared clipboard controller so a detached
    // element isn't retained until ctx teardown. `initCallback` re-runs on
    // reconnect and re-registers the scope.
    this._unregisterClipboardScope?.();
    this._unregisterClipboardScope = null;
  }

  public override render() {
    return html`${unsafeSVG(svgIconsSprite)}`;
  }
}
