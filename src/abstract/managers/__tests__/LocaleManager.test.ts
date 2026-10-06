import { describe, expect, it, vi } from 'vitest';
import { PubSub } from '../../../lit/PubSubCompat';
import type { SharedState } from '../../../lit/SharedState';
import { createSharedInstancesBag } from '../../../lit/shared-instances';
import { defineLocale, type LocaleDefinition } from '../../localeRegistry';
import { sharedConfigKey } from '../../sharedConfigKey';
import { LocaleManager } from '../LocaleManager';
import type { PluginManager } from '../plugin';

describe('LocaleManager', () => {
  it('does not read the shared plugin manager when destroyed while a locale is resolving', async () => {
    let resolveLocale!: (definition: LocaleDefinition) => void;
    defineLocale('xx-teardown', () => new Promise((resolve) => (resolveLocale = resolve)));
    const ctxName = 'locale-manager-teardown';
    const ctx = PubSub.registerCtx<Record<string, unknown>>(
      {
        '*pluginManager': { snapshot: () => ({ l10n: [] }), onPluginsChange: () => () => {} },
        [sharedConfigKey('localeName')]: '',
        [sharedConfigKey('localeDefinitionOverride')]: null,
      },
      ctxName,
    ) as unknown as PubSub<SharedState>;
    const manager = new LocaleManager(createSharedInstancesBag(() => ctx));
    ctx.pub(sharedConfigKey('localeName'), 'xx-teardown');

    // What LitBlock.destroyCtxCallback does: destroy the instances, null their keys, delete the ctx.
    manager.destroy();
    ctx.pub('*pluginManager', null as unknown as PluginManager);
    PubSub.deleteCtx(ctxName);

    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    resolveLocale({} as LocaleDefinition);
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
  });
});
