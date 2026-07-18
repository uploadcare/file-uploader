import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { SourceButtonConfig } from '../../blocks/SourceBtn/SourceBtn';
import type { SharedInstancesBag } from '../../lit/shared-instances';
import { stringToArray } from '../../utils/stringToArray';
import type { PluginSourceRegistration } from '../managers/plugin';
import type { ConfigController } from './ConfigController';

export type SourceListControllerOptions = {
  config: ConfigController;
  sharedInstancesBag: SharedInstancesBag;
  onSourcesChange: (sources: SourceButtonConfig[]) => void;
};

export class SourceListController implements ReactiveController {
  private _rawSourceList: string[] = [];
  private _unsubscribePlugins?: () => void;
  private _unsubscribeConfig?: () => void;
  private _unsubscribePluginManagerWhen?: () => void;
  private _config: ConfigController;
  private _sharedInstancesBag: SharedInstancesBag;
  private _onSourcesChange: (sources: SourceButtonConfig[]) => void;

  public constructor(host: ReactiveControllerHost, options: SourceListControllerOptions) {
    this._config = options.config;
    this._sharedInstancesBag = options.sharedInstancesBag;
    this._onSourcesChange = options.onSourcesChange;
    host.addController(this);
  }

  public hostConnected(): void {
    // Read the `sourceList` config key directly off the `ConfigController`
    // (M-god step 7: off the `*cfg/*` facade). Fire once with the current value,
    // then on every actual change of this key — the same immediate-then-deduped
    // per-key semantics the `ctx.sub(sharedConfigKey('sourceList'), …)` facade
    // subscription provided.
    let lastSourceList = this._config.get('sourceList');
    const applySourceList = (val: string): void => {
      this._rawSourceList = stringToArray(val);
      this._updateSources();
    };
    applySourceList(lastSourceList);
    this._unsubscribeConfig = this._config.subscribe(() => {
      const next = this._config.get('sourceList');
      if (!Object.is(next, lastSourceList)) {
        lastSourceList = next;
        applySourceList(next);
      }
    });

    // `*pluginManager` is constructed by a v1 `LitBlock` (e.g. `<uc-drop-area>`)
    // and isn't guaranteed to exist yet at hostConnected time — a `ChildBlock`-
    // only composition (a ported solution root with no v1 block having
    // connected yet) can adopt this controller before that registration lands.
    // `bag.when` fires immediately if it's already there, else waits and fires
    // once — re-run `_updateSources` either way so plugin-provided sources
    // (e.g. camera) show up once the plugin manager becomes available.
    this._unsubscribePluginManagerWhen = this._sharedInstancesBag.when('pluginManager', (pluginManager) => {
      if (pluginManager.onPluginsChange) {
        this._unsubscribePlugins = pluginManager.onPluginsChange(() => this._updateSources());
      }
      this._updateSources();
    });

    this._updateSources();
  }

  public hostDisconnected(): void {
    this._unsubscribePlugins?.();
    this._unsubscribePlugins = undefined;

    this._unsubscribeConfig?.();
    this._unsubscribeConfig = undefined;

    this._unsubscribePluginManagerWhen?.();
    this._unsubscribePluginManagerWhen = undefined;
  }

  private _updateSources(): void {
    const pluginManager = this._sharedInstancesBag.pluginManagerOrNull;
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

    this._onSourcesChange(sources);
  }

  private _expandSource(srcName: string, pluginSourceById: Map<string, PluginSourceRegistration>): string[] {
    const pluginSource = pluginSourceById.get(srcName);
    if (pluginSource?.expand) {
      return pluginSource.expand();
    }

    return [srcName];
  }

  private _makePluginSourceConfig(source: PluginSourceRegistration): SourceButtonConfig {
    return {
      id: source.id,
      label: source.label,
      icon: source.icon,
      onClick: () => source.onSelect(),
    };
  }
}
