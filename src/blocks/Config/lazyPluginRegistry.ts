import type { UploaderPlugin } from '../../abstract/managers/plugin';
import type { ConfigType } from '../../types/index';

export type LazyPluginEntry = {
  pluginId: string;
  isEnabled: () => boolean;
  load: () => UploaderPlugin | undefined | Promise<UploaderPlugin | undefined>;
};

export type LazyPluginEntryArgs = {
  useCloudImageEditor: () => ConfigType['useCloudImageEditor'];
  imageShrink: () => ConfigType['imageShrink'];
  sourceList: () => ConfigType['sourceList'];
};

export type LazyPluginEntryFactory = (args: LazyPluginEntryArgs) => LazyPluginEntry[];

export const withLazyPlugins = async ({
  plugins,
  entries,
  signal,
}: {
  plugins: () => UploaderPlugin[];
  entries: LazyPluginEntry[];
  signal: AbortSignal;
}): Promise<UploaderPlugin[]> => {
  const current = plugins();
  const lazyIds = new Set(entries.map((e) => e.pluginId));
  const userPlugins = current.filter((p) => !lazyIds.has(p?.id));

  const loadResults = await Promise.all(
    entries.map(async (entry): Promise<UploaderPlugin | null> => {
      if (!entry.isEnabled()) return null;
      const existing = current.find((p) => p?.id === entry.pluginId);
      if (existing) return existing;
      try {
        const plugin = await entry.load();
        if (signal.aborted || !entry.isEnabled()) return null;
        return plugin ?? null;
      } catch (error) {
        if (!signal.aborted) {
          console.warn(`[${entry.pluginId}] Failed to load plugin`, error);
        }
        return null;
      }
    }),
  );

  if (signal.aborted) return current;

  const lazyPlugins = loadResults.filter((p): p is UploaderPlugin => p !== null);
  const next = [...userPlugins, ...lazyPlugins];

  if (next.length === current.length && next.every((p, i) => p === current[i])) {
    return current;
  }

  return next;
};
