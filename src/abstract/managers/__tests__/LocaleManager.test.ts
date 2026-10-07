import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { PubSub } from '../../../lit/PubSubCompat';
import type { SharedState } from '../../../lit/SharedState';
import { createSharedInstancesBag } from '../../../lit/shared-instances';
import { defineLocale, type LocaleDefinition } from '../../localeRegistry';
import { sharedConfigKey } from '../../sharedConfigKey';
import { LocaleManager } from '../LocaleManager';

describe('LocaleManager', () => {
  it('does not apply a locale that resolves after it was destroyed', async () => {
    let resolveLocale!: (definition: LocaleDefinition) => void;
    defineLocale('xx-teardown', () => new Promise((resolve) => (resolveLocale = resolve)));
    const snapshot = vi.fn(() => ({ l10n: [] }));
    const ctxName = 'locale-manager-teardown';
    const ctx = PubSub.registerCtx<Record<string, unknown>>(
      {
        '*pluginManager': { snapshot, onPluginsChange: () => () => {} },
        [sharedConfigKey('localeName')]: '',
        [sharedConfigKey('localeDefinitionOverride')]: null,
      },
      ctxName,
    ) as unknown as PubSub<SharedState>;
    onTestFinished(() => PubSub.deleteCtx(ctxName));
    const manager = new LocaleManager(createSharedInstancesBag(() => ctx));
    ctx.pub(sharedConfigKey('localeName'), 'xx-teardown');

    manager.destroy();
    resolveLocale({} as LocaleDefinition);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(snapshot).not.toHaveBeenCalled();
  });
});
