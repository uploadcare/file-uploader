import type { SourceButtonConfig } from '../../blocks/SourceBtn/SourceBtn';
import type { PubSub } from '../../lit/PubSubCompat';
import type { SharedState } from '../../lit/SharedState';
import type { SharedInstancesBag } from '../../lit/shared-instances';
import { stringToArray } from '../../utils/stringToArray';
import type { PluginSourceRegistration } from '../managers/plugin';
import { sharedConfigKey } from '../sharedConfigKey';

export type SourceListControllerOptions = {
  ctx: PubSub<SharedState>;
  sharedInstancesBag: SharedInstancesBag;
  onSourcesChange: (sources: SourceButtonConfig[]) => void;
};

/**
 * Controller that manages source list business logic.
 * Handles source list configuration, plugin integration, and source expansion.
 */
export class SourceListController {
  private _rawSourceList: string[] = [];
  private _sources: SourceButtonConfig[] = [];
  private _unsubscribePlugins?: () => void;
  private _unsubscribeConfig?: () => void;
  private _ctx: PubSub<SharedState>;
  private _sharedInstancesBag: SharedInstancesBag;
  private _onSourcesChange: (sources: SourceButtonConfig[]) => void;

  public constructor(options: SourceListControllerOptions) {
    this._ctx = options.ctx;
    this._sharedInstancesBag = options.sharedInstancesBag;
    this._onSourcesChange = options.onSourcesChange;
  }

  /**
   * Initialize the controller and start listening to config and plugin changes
   */
  public init(): void {
    // Subscribe to sourceList config changes
    this._unsubscribeConfig = this._ctx.sub(sharedConfigKey('sourceList'), (val: string) => {
      this._rawSourceList = stringToArray(val);
      this._updateSources();
    });

    // Subscribe to plugin changes
    const pluginManager = this._sharedInstancesBag.pluginManager;
    if (pluginManager?.onPluginsChange) {
      this._unsubscribePlugins = pluginManager.onPluginsChange(() => this._updateSources());
    }

    // Perform initial update
    this._updateSources();
  }

  /**
   * Clean up subscriptions and resources
   */
  public destroy(): void {
    this._unsubscribePlugins?.();
    this._unsubscribePlugins = undefined;

    this._unsubscribeConfig?.();
    this._unsubscribeConfig = undefined;
  }

  /**
   * Get the current list of sources
   */
  public getSources(): SourceButtonConfig[] {
    return this._sources;
  }

  /**
   * Update sources based on the current raw source list and available plugins
   */
  private _updateSources(): void {
    const pluginManager = this._sharedInstancesBag.pluginManager;
    const pluginSources = pluginManager?.snapshot().sources ?? [];
    const pluginSourceById = new Map(pluginSources.map((source) => [source.id, source]));

    const sources: SourceButtonConfig[] = [];

    this._rawSourceList.forEach((srcName) => {
      const expanded = this._expandSource(srcName, pluginSourceById);

      // If expansion returned different entries (e.g., camera -> mobile modes), resolve them
      const expandedDiffer = expanded.length !== 1 || expanded[0] !== srcName;
      if (expandedDiffer) {
        for (const name of expanded) {
          const pluginSource = pluginSourceById.get(name);
          if (pluginSource) {
            sources.push(this._makePluginSourceConfig(pluginSource));
          }
        }
        return;
      }

      const pluginSource = pluginSourceById.get(srcName);
      if (pluginSource) {
        sources.push(this._makePluginSourceConfig(pluginSource));
      }
    });

    this._sources = sources;
    this._onSourcesChange(this._sources);
  }

  /**
   * Expand a source name into one or more source IDs
   */
  private _expandSource(srcName: string, pluginSourceById: Map<string, PluginSourceRegistration>): string[] {
    const pluginSource = pluginSourceById.get(srcName);
    if (pluginSource?.expand) {
      return pluginSource.expand();
    }

    return [srcName];
  }

  /**
   * Convert a plugin source registration into a source button config
   */
  private _makePluginSourceConfig(source: PluginSourceRegistration): SourceButtonConfig {
    return {
      id: source.id,
      label: source.label,
      icon: source.icon,
      onClick: () => source.onSelect(),
    };
  }
}
