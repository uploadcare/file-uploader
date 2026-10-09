import { describe, expect, it, onTestFinished } from 'vitest';
import { PubSub } from '../../../lit/PubSubCompat';
import type { SharedState } from '../../../lit/SharedState';
import { createSharedInstancesBag } from '../../../lit/shared-instances';
import { default as en } from '../../../locales/file-uploader/en';
import { defineLocale, type LocaleDefinition } from '../../localeRegistry';
import { sharedConfigKey } from '../../sharedConfigKey';
import { LocaleManager, localeStateKey } from '../LocaleManager';

describe('LocaleManager', () => {
  it('does not apply a locale that resolves after it was destroyed', async () => {
    let resolveLocale!: (definition: LocaleDefinition) => void;
    defineLocale('xx-teardown', () => new Promise((resolve) => (resolveLocale = resolve)));
    // A plugin that also ships the locale: applying it would publish this string too.
    const pluginL10n = [{ pluginId: 'p', 'xx-teardown': { 'drop-files-here': 'plugin xx' } }];
    const ctxName = 'locale-manager-teardown';
    const ctx = PubSub.registerCtx<Record<string, unknown>>(
      {
        '*pluginManager': { snapshot: () => ({ l10n: pluginL10n }), onPluginsChange: () => () => {} },
        [sharedConfigKey('localeName')]: '',
        [sharedConfigKey('localeDefinitionOverride')]: null,
      },
      ctxName,
    ) as unknown as PubSub<SharedState>;
    onTestFinished(() => PubSub.deleteCtx(ctxName));
    const manager = new LocaleManager(createSharedInstancesBag(() => ctx));
    ctx.pub(sharedConfigKey('localeName'), 'xx-teardown');

    manager.destroy();
    resolveLocale({ 'upload-files': 'xx' } as LocaleDefinition);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ctx.read(localeStateKey('upload-files'))).toBe(en['upload-files']);
    expect(ctx.read(localeStateKey('drop-files-here'))).toBe(en['drop-files-here']);
  });
});
