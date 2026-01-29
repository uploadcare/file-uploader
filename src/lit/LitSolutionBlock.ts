import { html } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { solutionBlockCtx } from '../abstract/CTX';
import svgIconsSprite from '../blocks/themes/uc-basic/svg-sprite';
import { PluginManager } from '../abstract/managers/PluginManager';
import type { PluginConfig } from '../abstract/Plugin';
import { LitBlock } from './LitBlock';

export class LitSolutionBlock extends LitBlock {
  public static override styleAttrs = ['uc-wgt-common'];
  public override init$ = solutionBlockCtx(this);

  protected _pluginManager: PluginManager;

  constructor() {
    super();
    this._pluginManager = new PluginManager(this);
  }

  /**
   * Register a plugin with this solution
   * @param pluginConfig - Plugin configuration
   */
  public registerPlugin(pluginConfig: PluginConfig): void {
    this._pluginManager.register(pluginConfig);
  }

  /**
   * Get the plugin manager instance
   */
  public get pluginManager(): PluginManager {
    return this._pluginManager;
  }

  public override initCallback(): void {
    super.initCallback();
    this.a11y?.registerBlock(this);
    
    // Initialize all registered plugins
    this._pluginManager.initPlugins();
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    
    // Cleanup plugins when solution is disconnected
    this._pluginManager.destroyPlugins();
  }

  public override render() {
    return html`${unsafeSVG(svgIconsSprite)}`;
  }
}
