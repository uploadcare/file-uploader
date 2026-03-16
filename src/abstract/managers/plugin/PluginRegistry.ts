import { type CustomConfigDefinition, CustomConfigRegistry } from '../../customConfigOptions';
import type {
  Owned,
  PluginActivityRegistration,
  PluginFileActionRegistration,
  PluginFileHookRegistration,
  PluginI18nRegistration,
  PluginIconRegistration,
  PluginRegistrySnapshot,
  PluginSourceRegistration,
} from './PluginTypes';

export class PluginRegistry {
  private _sources: Owned<PluginSourceRegistration>[] = [];
  private _activities: Owned<PluginActivityRegistration>[] = [];
  private _fileActions: Owned<PluginFileActionRegistration>[] = [];
  private _fileHooks: Owned<PluginFileHookRegistration>[] = [];
  private _icons: Owned<PluginIconRegistration>[] = [];
  private _i18n: Owned<PluginI18nRegistration>[] = [];
  public readonly config = new CustomConfigRegistry();

  private _own<T>(pluginId: string, item: T): Owned<T> {
    return { ...item, pluginId } as Owned<T>;
  }

  public addSource(pluginId: string, item: PluginSourceRegistration): PluginSourceRegistration {
    this._sources.push(this._own(pluginId, item));
    return item;
  }

  public addActivity(pluginId: string, item: PluginActivityRegistration): PluginActivityRegistration {
    this._activities.push(this._own(pluginId, item));
    return item;
  }

  public addFileAction(pluginId: string, item: PluginFileActionRegistration): PluginFileActionRegistration {
    this._fileActions.push(this._own(pluginId, item));
    return item;
  }

  public addFileHook(pluginId: string, item: PluginFileHookRegistration): PluginFileHookRegistration {
    this._fileHooks.push(this._own(pluginId, item));
    return item;
  }

  public addIcon(pluginId: string, item: PluginIconRegistration): PluginIconRegistration {
    this._icons.push(this._own(pluginId, item));
    return item;
  }

  public addI18n(pluginId: string, item: PluginI18nRegistration): PluginI18nRegistration {
    this._i18n.push(this._own(pluginId, item));
    return item;
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
    this._i18n = this._i18n.filter((item) => item.pluginId !== pluginId);
    this.config.unregisterByPlugin(pluginId);
  }

  public snapshot(): PluginRegistrySnapshot {
    return {
      sources: [...this._sources],
      activities: [...this._activities],
      fileActions: [...this._fileActions],
      fileHooks: [...this._fileHooks],
      icons: [...this._icons],
      i18n: [...this._i18n],
    };
  }
}
