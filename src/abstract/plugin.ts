import type { PluginDefinition } from '../abstract/controllers/PluginRegistryController';

export type {
  ActivityRegistration,
  FileActionRegistration,
  PluginDefinition,
  PluginSetupContext,
  SourceRegistration,
} from '../abstract/controllers/PluginRegistryController';

/** Identity wrapper for type inference. */
export function definePlugin(def: PluginDefinition): PluginDefinition {
  return def;
}
