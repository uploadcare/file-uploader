import { deserializeCsv } from '../utils/comma-separated';
import { ConfigController } from './controllers/ConfigController';
import type { ControllerContainer } from './di/ControllerContainer';
import { Disposables } from './di/Disposables';
import { PluginController, type PluginLabel, type PluginSourceRegistration } from './managers/plugin';

/** What a source button shows and does. */
export type SourceButtonConfig = {
  id: string;
  label: PluginLabel;
  icon?: string;
  onClick: () => void | Promise<void>;
};

/**
 * The source buttons for a `sourceList`, in its order. A source that expands (camera on a phone) is replaced by what
 * it expands to, and an id no plugin registered is skipped.
 */
export function resolveSources(
  sourceList: readonly string[],
  pluginSources: readonly PluginSourceRegistration[],
): SourceButtonConfig[] {
  const byId = new Map(pluginSources.map((source) => [source.id, source]));
  return sourceList
    .flatMap((id) => byId.get(id)?.expand?.() ?? [id])
    .flatMap((id) => {
      const source = byId.get(id);
      return source
        ? [{ id: source.id, label: source.label, icon: source.icon, onClick: () => source.onSelect() }]
        : [];
    });
}

/**
 * Calls `onChange` with the ctx's source buttons now and whenever `sourceList` or the registered plugins change. The
 * plugin manager may be bound later than this is called; its sources show up once it is. Returns the unsubscribe.
 */
export function observeSources(
  container: ControllerContainer,
  onChange: (sources: SourceButtonConfig[]) => void,
): () => void {
  const config = container.get(ConfigController);
  const disposables = new Disposables();
  let sourceList: string[] = [];
  const emit = () =>
    onChange(resolveSources(sourceList, container.getOrNull(PluginController)?.snapshot().sources ?? []));

  disposables.add(
    config.observe(
      'sourceList',
      (value) => {
        sourceList = deserializeCsv(value);
        emit();
      },
      { immediate: true },
    ),
  );
  disposables.add(
    container.whenController(PluginController, (pluginManager) => {
      disposables.add(pluginManager.onPluginsChange(emit));
      emit();
    }),
  );
  return () => disposables.run();
}
