import { fileIsImage } from '../utils/fileTypes';
import type { OnAddHandler } from './controllers/UploadCollectionController';
import type { UploaderController } from './controllers/UploaderController';
import type { CustomConfigDefinition } from './customConfigOptions';
import type {
  PluginActivityApi,
  PluginActivityRegistration,
  PluginApi,
  PluginConfigApi,
  PluginFileActionRegistration,
  PluginFileEntryUpdate,
  PluginFileHookRegistration,
  PluginFilesApi,
  PluginIconRegistration,
  PluginL10nRegistration,
  PluginRegistryApi,
  PluginSourceRegistration,
} from './plugin-types-legacy';
import type { UploaderApi } from './UploaderApi';

/**
 * Builds the v1 plugin context — `{ pluginApi, uploaderApi }` — backed by
 * v2 controllers. Lets v1-authored plugins (and tests that author their
 * own v1-shape plugins) keep working against v2's runtime.
 *
 * Each registry method routes to the matching v2 controller. The returned
 * `teardown` aggregates unsubscribers from every successful registration
 * so callers can release plugin-owned state on uninstall.
 */
export function buildLegacyPluginCtx(
  controller: UploaderController,
  pluginId: string,
): { pluginApi: PluginApi; uploaderApi: UploaderApi; teardown: () => void } {
  const unsubs: Array<() => void> = [];

  const registry: PluginRegistryApi = {
    registerSource: (source: PluginSourceRegistration) => {
      unsubs.push(
        controller.plugins.registerSource({
          id: source.id,
          label: source.label,
          icon: source.icon,
          onSelect: () => {
            void source.onSelect();
          },
          expand: source.expand,
        }),
      );
    },

    registerActivity: (activity: PluginActivityRegistration) => {
      unsubs.push(
        controller.plugins.registerActivity({
          id: activity.id,
          render: activity.render,
        }),
      );
    },

    registerFileAction: (action: PluginFileActionRegistration) => {
      unsubs.push(
        controller.plugins.registerAction({
          id: action.id,
          label: action.label,
          icon: action.icon,
          shouldRender: action.shouldRender,
          onClick: action.onClick,
        }),
      );
    },

    registerFileHook: (hook: PluginFileHookRegistration) => {
      if (hook.type === 'beforeUpload') {
        unsubs.push(
          controller.collection.registerBeforeUpload(async ({ file }) => {
            const abort = new AbortController();
            const handler = hook.handler({ file, signal: abort.signal });
            const result = await withTimeout(handler, hook.timeout ?? 30_000, () => abort.abort());
            if (result?.file && result.file !== file) {
              return { file: result.file as File };
            }
            return undefined;
          }),
        );
      } else if (hook.type === 'onAdd') {
        const onAdd: OnAddHandler = async ({ file, signal }) => {
          const result = await withTimeout(hook.handler({ file, signal }), hook.timeout ?? 30_000, () => undefined);
          return { file: result?.file ?? file };
        };
        unsubs.push(controller.collection.registerOnAdd(onAdd));
      }
    },

    registerIcon: (icon: PluginIconRegistration) => {
      unsubs.push(controller.plugins.registerIcon(icon.name, icon.svg));
    },

    registerL10n: (l10n: PluginL10nRegistration) => {
      // v2's LocaleController only holds the active dictionary; flatten the
      // current-locale entries (default `en`) into it. Plugin-supplied locale
      // switching beyond `en` is not yet supported in v2.
      const localeId = (controller.config.values as { localeName?: string }).localeName ?? 'en';
      const entries = l10n[localeId] ?? l10n.en ?? {};
      if (Object.keys(entries).length > 0) {
        // v1 parity: l10n overrides persist after the plugin is unregistered.
        // Intentionally not tracking the unsub here.
        controller.locale.merge(entries);
      }
    },

    registerConfig: <T>(definition: CustomConfigDefinition<T>) => {
      controller.config.register(definition);
    },
  };

  const config: PluginConfigApi = {
    get: ((name: string) => {
      const values = controller.config.values as Record<string, unknown>;
      return values[name];
      // biome-ignore lint/suspicious/noExplicitAny: PluginConfigApi.get is typed against the merged ConfigType which v2 doesn't replicate.
    }) as any,

    subscribe: ((name: string, callback: (value: unknown) => void) => {
      const values = controller.config.values as Record<string, unknown>;
      let last = values[name];
      // v1 fires the callback once with the current value, then on change.
      Promise.resolve().then(() => callback(last));
      const unsub = controller.config.subscribe(() => {
        const next = values[name];
        if (next === last) return;
        last = next;
        callback(next);
      });
      unsubs.push(unsub);
      return unsub;
      // biome-ignore lint/suspicious/noExplicitAny: same as above.
    }) as any,
  };

  const activity: PluginActivityApi = {
    getParams: () => controller.router.params as Record<string, unknown>,

    subscribeToParams: (callback) => {
      let last = controller.router.params;
      Promise.resolve().then(() => callback(last as Record<string, unknown>));
      const unsub = controller.router.subscribe(() => {
        const next = controller.router.params;
        if (next === last) return;
        last = next;
        callback(next as Record<string, unknown>);
      });
      unsubs.push(unsub);
      return unsub;
    },
  };

  const files: PluginFilesApi = {
    update: (internalId: string, changes: PluginFileEntryUpdate) => {
      const entry = controller.collection.read(internalId);
      if (!entry) return;
      if (changes.file !== undefined) {
        const f = changes.file;
        entry.setValue('file', f as File);
        entry.setValue('fileSize', f.size);
        entry.setValue('mimeType', f.type || null);
        entry.setValue('isImage', fileIsImage(f));
        if (f instanceof File) entry.setValue('fileName', f.name);
      }
      if (changes.cdnUrl !== undefined) entry.setValue('cdnUrl', changes.cdnUrl);
      if (changes.cdnUrlModifiers !== undefined) {
        entry.setValue('cdnUrlModifiers', changes.cdnUrlModifiers);
      }
      if (changes.mimeType !== undefined) {
        entry.setValue('mimeType', changes.mimeType);
      }
    },
  };

  void pluginId;

  const pluginApi: PluginApi = { registry, config, activity, files };
  const uploaderApi = controller.api;

  const teardown = (): void => {
    for (const u of unsubs) {
      try {
        u();
      } catch (err) {
        console.warn('[v2/legacy-bridge] teardown failed', err);
      }
    }
    unsubs.length = 0;
  };

  return { pluginApi, uploaderApi, teardown };
}

async function withTimeout<T>(value: T | Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  const result = await Promise.race([
    Promise.resolve(value),
    new Promise<T>((_, reject) =>
      setTimeout(() => {
        onTimeout();
        reject(new Error(`Plugin hook timed out after ${ms}ms`));
      }, ms),
    ),
  ]);
  return result;
}
