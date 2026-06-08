import type { OutputFileEntry } from '../../types/exported';
import { Listeners } from '../host-subscription';
import type { ActivityRoute } from './RouterController';
import type { BeforeUploadHandler } from './UploadCollectionController';
import type { UploaderController } from './UploaderController';

export interface SourceRegistration {
  id: string;
  label?: string;
  icon?: string;
  onSelect: () => void;
  /**
   * Returns a list of source ids that should be rendered in place of this
   * one (e.g. expand "camera" into "mobile-photo-camera" / "mobile-video-
   * camera" on devices with `htmlMediaCapture`). Default: `[this.id]`.
   */
  expand?: () => string[];
  /**
   * If true, this source is not shown directly in the source list — it
   * exists only to be referenced by another source's `expand()`. Default:
   * false.
   */
  hiddenFromList?: boolean;
}

export interface ActivityRegistration {
  id: string;
  // biome-ignore lint/suspicious/noConfusingVoidType: `void` is the standard "may or may not return a teardown" signature for plugin hooks; switching to `undefined` would force every consumer to add `return undefined`.
  render: (host: HTMLElement, params: Record<string, unknown>) => (() => void) | void;
  routes?: ActivityRoute;
}

export interface FileActionRegistration {
  id: string;
  label?: string;
  icon?: string;
  shouldRender?: (item: OutputFileEntry) => boolean;
  onClick: (item: OutputFileEntry) => void;
}

export interface PluginDefinition {
  id: string;
  // biome-ignore lint/suspicious/noConfusingVoidType: see ActivityRegistration.render — `void` is the "optional teardown" signature.
  setup: (ctx: PluginSetupContext) => (() => void) | void;
}

export interface PluginSetupContext {
  uploader: UploaderController;
  sources: { register: (s: SourceRegistration) => () => void };
  activities: { register: (a: ActivityRegistration) => () => void };
  actions: { register: (a: FileActionRegistration) => () => void };
  hooks: { beforeUpload: (handler: BeforeUploadHandler) => () => void };
  config: {
    register: <T>(name: string, defaultValue: T) => void;
    get: <T = unknown>(name: string) => T;
    set: (name: string, value: unknown) => void;
  };
  locale: { merge: (entries: Record<string, string>) => () => void };
  icons: { register: (name: string, svg: string) => () => void };
}

/**
 * v2-native plugin registry. Holds source / activity / action / icon
 * registrations and notifies subscribers on change. Plugins install via
 * `UploaderController.install(plugin)` — no v1 bridge, no PluginManager.
 */
export class PluginRegistryController {
  private _sources = new Map<string, SourceRegistration>();
  private _activities = new Map<string, ActivityRegistration>();
  private _actions = new Map<string, FileActionRegistration>();
  private _icons = new Map<string, string>();
  private _listeners = new Listeners();
  // biome-ignore lint/suspicious/noConfusingVoidType: mirrors `PluginDefinition.setup`'s return; entries hold the plugin teardown or void when there's nothing to undo.
  private _installed = new Map<string, (() => void) | void>();

  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  public get sources(): SourceRegistration[] {
    return [...this._sources.values()];
  }

  public get activities(): ActivityRegistration[] {
    return [...this._activities.values()];
  }

  public get actions(): FileActionRegistration[] {
    return [...this._actions.values()];
  }

  public source(id: string): SourceRegistration | undefined {
    return this._sources.get(id);
  }

  public activity(id: string): ActivityRegistration | undefined {
    return this._activities.get(id);
  }

  public registerSource(s: SourceRegistration): () => void {
    if (this._sources.has(s.id)) {
      console.warn(`[v2/plugins] Source "${s.id}" is already registered. Skipping.`);
      return () => {};
    }
    this._sources.set(s.id, s);
    this._listeners.notify();
    return () => {
      this._sources.delete(s.id);
      this._listeners.notify();
    };
  }

  public registerActivity(a: ActivityRegistration): () => void {
    if (this._activities.has(a.id)) {
      console.warn(`[v2/plugins] Activity "${a.id}" is already registered. Skipping.`);
      return () => {};
    }
    this._activities.set(a.id, a);
    this._listeners.notify();
    return () => {
      this._activities.delete(a.id);
      this._listeners.notify();
    };
  }

  public registerAction(a: FileActionRegistration): () => void {
    this._actions.set(a.id, a);
    this._listeners.notify();
    return () => {
      this._actions.delete(a.id);
      this._listeners.notify();
    };
  }

  public registerIcon(name: string, svg: string): () => void {
    const previous = this._icons.get(name);
    this._icons.set(name, svg);
    this._listeners.notify();
    return () => {
      if (previous === undefined) this._icons.delete(name);
      else this._icons.set(name, previous);
      this._listeners.notify();
    };
  }

  public icon(name: string): string | undefined {
    return this._icons.get(name);
  }

  public install(plugin: PluginDefinition, ctx: PluginSetupContext, extraTeardown?: () => void): void {
    if (this._installed.has(plugin.id)) {
      console.warn(`[v2/plugins] Plugin "${plugin.id}" is a duplicate — already installed. Skipping.`);
      // Release the bridge unsubs the caller accumulated for this attempt so
      // they don't leak.
      extraTeardown?.();
      return;
    }
    if (!plugin.id) {
      console.warn(`[v2/plugins] Plugin is missing required "id" field. Skipping.`);
      extraTeardown?.();
      return;
    }
    let setupResult: unknown;
    try {
      setupResult = plugin.setup(ctx);
    } catch (err) {
      console.error(`[v2/plugins] Plugin "${plugin.id}" setup() threw`, err);
      extraTeardown?.();
      return;
    }
    // biome-ignore lint/suspicious/noConfusingVoidType: the plugin's setup returns either a teardown or void; reflecting that union here preserves the public contract.
    const finalize = (pluginTeardown: (() => void) | void): void => {
      const combined = (): void => {
        if (typeof pluginTeardown === 'function') {
          try {
            pluginTeardown();
          } catch (e) {
            console.warn(`[v2/plugins] Plugin "${plugin.id}" teardown failed`, e);
          }
        }
        extraTeardown?.();
      };
      this._installed.set(plugin.id, combined);
    };
    if (setupResult && typeof (setupResult as Promise<unknown>).then === 'function') {
      // Reserve the slot so re-entrant installs are deduped while we await.
      this._installed.set(plugin.id, () => extraTeardown?.());
      // biome-ignore lint/suspicious/noConfusingVoidType: same shape as the sync branch — await the promise, then forward to `finalize`.
      (setupResult as Promise<(() => void) | void>)
        .then((td) => finalize(td))
        .catch((err) => {
          console.error(`[v2/plugins] Plugin "${plugin.id}" setup() rejected`, err);
          this._installed.delete(plugin.id);
          extraTeardown?.();
        });
      return;
    }
    // biome-ignore lint/suspicious/noConfusingVoidType: matches `finalize`'s declared parameter type.
    finalize(setupResult as (() => void) | void);
  }

  public uninstall(pluginId: string): void {
    const teardown = this._installed.get(pluginId);
    if (typeof teardown === 'function') teardown();
    this._installed.delete(pluginId);
  }

  public destroy(): void {
    for (const id of [...this._installed.keys()]) this.uninstall(id);
    this._sources.clear();
    this._activities.clear();
    this._actions.clear();
    this._icons.clear();
    this._listeners.clear();
  }
}
