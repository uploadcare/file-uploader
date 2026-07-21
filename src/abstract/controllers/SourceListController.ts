import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { SourceButtonConfig } from '../../blocks/SourceBtn/SourceBtn';
import { stringToArray } from '../../utils/stringToArray';
import type { ControllerContainer } from '../di/ControllerContainer';
import { Disposables } from '../di/Disposables';
import { PluginController, type PluginSourceRegistration } from '../managers/plugin';
import type { ConfigController } from './ConfigController';

export type SourceListControllerOptions = {
  config: ConfigController;
  container: ControllerContainer;
  onSourcesChange: (sources: SourceButtonConfig[]) => void;
};

export class SourceListController implements ReactiveController {
  private _rawSourceList: string[] = [];
  // One teardown registry for every subscription this controller opens (config
  // key, plugin-manager availability, and plugin-change), drained in one
  // isolate-and-warn pass on `hostDisconnected` — no per-subscription
  // `_unsubscribe*` bookkeeping.
  private _disposables = new Disposables();
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
    // (M-god step 7: off the `*cfg/*` facade). Atomic per-key `observe` with
    // `{ immediate: true }` fires once with the current value then on every
    // actual change of this key — the same immediate-then-deduped per-key
    // semantics the `ctx.sub('*cfg/sourceList', …)` facade subscription provided.
    this._disposables.add(
      this._config.observe(
        'sourceList',
        (val) => {
          this._rawSourceList = stringToArray(val);
          this._updateSources();
        },
        { immediate: true },
      ),
    );

    // `PluginController` is bound + resolved lazily by `ensureUploaderScope` /
    // `ensurePluginManager` and isn't guaranteed to exist yet at hostConnected
    // time — a `ChildBlock`-only composition (a ported solution root with no
    // uploader block having attached yet) can adopt this controller before that
    // registration lands. `container.whenController` fires immediately if it's
    // already constructed, else waits and fires once on the first `get()` — the
    // cross-token analogue of the former `bag.when('pluginManager', …)`. Re-run
    // `_updateSources` either way so plugin-provided sources (e.g. camera) show
    // up once the plugin manager becomes available.
    this._disposables.add(
      this._container.whenController(PluginController, (pluginManager) => {
        this._disposables.add(pluginManager.onPluginsChange(() => this._updateSources()));
        this._updateSources();
      }),
    );

    this._updateSources();
  }

  public hostDisconnected(): void {
    // Drains the config, plugin-manager-availability, and plugin-change
    // teardowns in one pass. Draining the `whenController` teardown also cancels
    // a still-pending availability callback, so it never subscribes post-disconnect.
    this._disposables.run();
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
