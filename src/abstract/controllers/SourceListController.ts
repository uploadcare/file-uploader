import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { SourceButtonConfig } from '../../blocks/SourceBtn/SourceBtn';
import { stringToArray } from '../../utils/stringToArray';
import type { ControllerContainer } from '../di/ControllerContainer';
import { PluginController, type PluginSourceRegistration } from '../managers/plugin';
import type { ConfigController } from './ConfigController';

export type SourceListControllerOptions = {
  config: ConfigController;
  container: ControllerContainer;
  onSourcesChange: (sources: SourceButtonConfig[]) => void;
};

export class SourceListController implements ReactiveController {
  private _rawSourceList: string[] = [];
  private _unsubscribePlugins?: () => void;
  private _unsubscribeConfig?: () => void;
  private _unsubscribePluginManagerWhen?: () => void;
  private _config: ConfigController;
  private _container: ControllerContainer;
  private _onSourcesChange: (sources: SourceButtonConfig[]) => void;

  public constructor(host: ReactiveControllerHost, options: SourceListControllerOptions) {
    this._config = options.config;
    this._container = options.container;
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

    // `PluginController` is bound + resolved lazily by `ensureUploaderScope` /
    // `ensurePluginManager` and isn't guaranteed to exist yet at hostConnected
    // time — a `ChildBlock`-only composition (a ported solution root with no
    // uploader block having attached yet) can adopt this controller before that
    // registration lands. `container.whenController` fires immediately if it's
    // already constructed, else waits and fires once on the first `get()` — the
    // cross-token analogue of the former `bag.when('pluginManager', …)`. Re-run
    // `_updateSources` either way so plugin-provided sources (e.g. camera) show
    // up once the plugin manager becomes available.
    this._unsubscribePluginManagerWhen = this._container.whenController(PluginController, (pluginManager) => {
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
    // `getOrNull` returns the `PluginController` only if already constructed on
    // this container (never `new`-ing it), matching the former
    // `bag.pluginManagerOrNull` null-tolerant read for a config-only/plugin-less
    // scope.
    const pluginManager = this._container.getOrNull(PluginController);
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
