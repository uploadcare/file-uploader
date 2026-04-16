import { type CustomConfigDefinition, CustomConfigRegistry } from '../../customConfigOptions';
import type {
  Owned,
  PluginActivityRegistration,
  PluginFileActionRegistration,
  PluginFileHookRegistration,
  PluginIconRegistration,
  PluginL10nRegistration,
  PluginRegistrySnapshot,
  PluginSourceRegistration,
} from './PluginTypes';

export class PluginRegistry {
  private _sources: Owned<PluginSourceRegistration>[] = [];
  private _activities: Owned<PluginActivityRegistration>[] = [];
  private _fileActions: Owned<PluginFileActionRegistration>[] = [];
  private _fileHooks: Owned<PluginFileHookRegistration>[] = [];
  private _icons: Owned<PluginIconRegistration>[] = [];
  private _l10n: Owned<PluginL10nRegistration>[] = [];
  public readonly config = new CustomConfigRegistry();

  private _own<T>(pluginId: string, item: T): Owned<T> {
    return { ...item, pluginId } as Owned<T>;
  }

  public addSource(pluginId: string, item: PluginSourceRegistration): void {
    const existing = this._sources.find((s) => s.id === item.id);
    if (existing) {
      console.warn(
        `[Plugin "${pluginId}"] Source with id "${item.id}" is already registered by plugin "${existing.pluginId}". Skipping.`,
      );
      return;
    }
    this._sources.push(this._own(pluginId, item));
  }

  public addActivity(pluginId: string, item: PluginActivityRegistration): void {
    const existing = this._activities.find((a) => a.id === item.id);
    if (existing) {
      console.warn(
        `[Plugin "${pluginId}"] Activity with id "${item.id}" is already registered by plugin "${existing.pluginId}". Skipping.`,
      );
      return;
    }
    this._activities.push(this._own(pluginId, item));
  }

  public addFileAction(pluginId: string, item: PluginFileActionRegistration): void {
    this._fileActions.push(this._own(pluginId, item));
  }

  public addFileHook(pluginId: string, item: PluginFileHookRegistration): void {
    this._fileHooks.push(this._own(pluginId, { timeout: 30_000, ...item }));
  }

  public addIcon(pluginId: string, item: PluginIconRegistration): void {
    this._icons.push(this._own(pluginId, item));
  }

  public addL10n(pluginId: string, item: PluginL10nRegistration): void {
    this._l10n.push(this._own(pluginId, item));
  }

  public addConfig<T>(pluginId: string, definition: CustomConfigDefinition<T>): void {
    this.config.register(pluginId, definition);
  }

  public purge(pluginId: string): void {
    this._sources = this._sources.filter((item) => item.pluginId !== pluginId);
    this._activities = this._activities.filter((item) => item.pluginId !== pluginId);
    this._fileActions = this._fileActions.filter((item) => item.pluginId !== pluginId);
    this._fileHooks = this._fileHooks.filter((item) => item.pluginId !== pluginId);
    this._icons = this._icons.filter((item) => item.pluginId !== pluginId);
    this._l10n = this._l10n.filter((item) => item.pluginId !== pluginId);
    this.config.unregisterByPlugin(pluginId);
  }

  public snapshot(): PluginRegistrySnapshot {
    return {
      sources: [...this._sources],
      activities: [...this._activities],
      fileActions: [...this._fileActions],
      fileHooks: [...this._fileHooks],
      icons: [...this._icons],
      l10n: [...this._l10n],
    };
  }
}
