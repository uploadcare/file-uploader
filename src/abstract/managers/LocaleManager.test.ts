import { describe, expect, it, vi } from 'vitest';
import { delay } from '../../utils/delay';
import { ConfigController } from '../controllers/ConfigController';
import { LocaleController } from '../controllers/LocaleController';
import { ControllerContainer } from '../di/ControllerContainer';
import type { LocaleDefinition } from '../localeRegistry';
import * as localeRegistry from '../localeRegistry';
import { LocaleManager } from './LocaleManager';
import type { PluginController } from './plugin';

type FakePluginManager = Pick<PluginController, 'onPluginsChange' | 'snapshot'>;

// `LocaleManager` is container-resolved now (M-god step 3b): a zero-arg ctor
// that `@inject`s `ConfigController`/`LocaleController`. Build all three through
// one throwaway container so the manager injects the same config/locale the
// specs then read/spy on.
const setup = () => {
  const container = new ControllerContainer();
  const config = container.get(ConfigController);
  const locale = container.get(LocaleController);
  const manager = container.get(LocaleManager);
  return { container, config, locale, manager };
};

// Wraps the real resolver as the default implementation (so every other test
// in this file resolves locales for real), while letting the same-tick
// staleness spec below swap in controllable deferreds for specific calls.
vi.mock('../localeRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../localeRegistry')>();
  return { ...actual, resolveLocaleDefinition: vi.fn(actual.resolveLocaleDefinition) };
});

/**
 * Dedicated coverage for `LocaleManager.activate()` (M9k Task 3 follow-up):
 * construction is side-effect-free (see the class doc), so `activate` is
 * where all of v1's construction-time behavior — seeding, config
 * subscriptions, plugin-manager coupling — actually lives. Pins its
 * idempotency contract, which `UploaderController.test.ts` and the
 * instance-lifecycle e2e specs don't exercise directly.
 */
describe('LocaleManager.activate', () => {
  it('is idempotent: a second activate() does not re-register the config subscriptions', () => {
    const { config, manager } = setup();
    const observeSpy = vi.spyOn(config, 'observe');

    manager.activate(null);
    const afterFirst = observeSpy.mock.calls.length;
    // localeName + localeDefinitionOverride — exactly two atomic `observe`s wired.
    expect(afterFirst).toBe(2);

    manager.activate(null);
    manager.activate(null);

    expect(observeSpy).toHaveBeenCalledTimes(afterFirst);
  });

  it('is idempotent: a second activate() does not re-seed the en dictionary over a value set since', () => {
    const { locale, manager } = setup();

    manager.activate(null);
    // Simulate a value having changed since first activation (e.g. a plugin
    // override, or the app writing a custom translation directly).
    locale.set('upload', 'Custom upload label');

    manager.activate(null);

    expect(locale.get('upload')).toBe('Custom upload label');
  });

  it('re-couples to a new plugin manager on re-activate without stacking the old subscription', () => {
    const { manager } = setup();

    const unsub1 = vi.fn();
    const pm1: FakePluginManager = {
      onPluginsChange: vi.fn(() => unsub1),
      snapshot: vi.fn(() => ({ l10n: [] }) as never),
    };
    manager.activate(pm1);
    expect(pm1.onPluginsChange).toHaveBeenCalledTimes(1);
    expect(unsub1).not.toHaveBeenCalled();

    const unsub2 = vi.fn();
    const pm2: FakePluginManager = {
      onPluginsChange: vi.fn(() => unsub2),
      snapshot: vi.fn(() => ({ l10n: [] }) as never),
    };
    manager.activate(pm2);

    // The old coupling is released exactly once, not left dangling alongside
    // the new one.
    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(pm2.onPluginsChange).toHaveBeenCalledTimes(1);
    expect(unsub2).not.toHaveBeenCalled();

    manager.destroy();
    expect(unsub2).toHaveBeenCalledTimes(1);
    // Still just once — destroy() must not double-release the already-swapped-
    // out first coupling.
    expect(unsub1).toHaveBeenCalledTimes(1);
  });

  it('re-activate isolate-and-warns: a throwing previous unsubscribe does not stop the new coupling being wired', () => {
    const { manager } = setup();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const unsub1 = vi.fn(() => {
      throw new Error('detach boom');
    });
    const pm1: FakePluginManager = {
      onPluginsChange: vi.fn(() => unsub1),
      snapshot: vi.fn(() => ({ l10n: [] }) as never),
    };
    manager.activate(pm1);

    const unsub2 = vi.fn();
    const pm2: FakePluginManager = {
      onPluginsChange: vi.fn(() => unsub2),
      snapshot: vi.fn(() => ({ l10n: [] }) as never),
    };

    // The old unsub throws on re-wire, but activate() contains it and still
    // establishes the new coupling rather than aborting half re-wired.
    expect(() => manager.activate(pm2)).not.toThrow();
    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();
    expect(pm2.onPluginsChange).toHaveBeenCalledTimes(1);

    // The stale (already-run) unsub was un-registered, so destroy() releases only
    // the new coupling and never re-invokes the throwing one.
    manager.destroy();
    expect(unsub2).toHaveBeenCalledTimes(1);
    expect(unsub1).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it('destroy() isolate-and-warns: a throwing plugin-coupling teardown does not stop the config-subscription teardowns', () => {
    const { config, locale, manager } = setup();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const pm: FakePluginManager = {
      onPluginsChange: vi.fn(() => () => {
        throw new Error('boom');
      }),
      snapshot: vi.fn(() => ({ l10n: [] }) as never),
    };
    manager.activate(pm);

    // A throwing teardown is contained; destroy() still completes and warns.
    expect(() => manager.destroy()).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();

    // ...and the config subscriptions were still released despite the throw.
    const setSpy = vi.spyOn(locale, 'set');
    config.set('localeName', 'fr');
    config.set('localeDefinitionOverride', { fr: { upload: 'Envoyer' } });
    expect(setSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('destroy() releases the config subscriptions and the plugin coupling: subsequent changes produce no callbacks', () => {
    const { config, locale, manager } = setup();

    const unsub = vi.fn();
    const pm: FakePluginManager = {
      onPluginsChange: vi.fn(() => unsub),
      snapshot: vi.fn(() => ({ l10n: [] }) as never),
    };

    manager.activate(pm);
    manager.destroy();

    expect(unsub).toHaveBeenCalledTimes(1);

    const setSpy = vi.spyOn(locale, 'set');
    // Both config keys LocaleManager wired subscriptions for — neither should
    // reach the (now-unsubscribed) callbacks.
    config.set('localeName', 'fr');
    config.set('localeDefinitionOverride', { fr: { upload: 'Envoyer' } });

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('destroy() is safe to call before activate() (never activated)', () => {
    const { manager } = setup();

    expect(() => manager.destroy()).not.toThrow();
  });

  it('applies plugin-provided locales for the active locale when plugins change', async () => {
    const { locale, manager } = setup();
    let pluginsChanged: (() => void) | undefined;
    const pm: FakePluginManager = {
      onPluginsChange: vi.fn((cb: () => void) => {
        pluginsChanged = cb;
        return vi.fn();
      }),
      snapshot: vi.fn(
        () =>
          ({
            l10n: [
              // Active-locale ('en') entry: applied, but an `undefined` value is skipped.
              { pluginId: 'p', en: { 'plugin-key': 'Plugin value', 'skip-key': undefined } },
              // Non-active-locale entry: skipped entirely (no `en` key).
              { pluginId: 'q', fr: { 'plugin-key': 'Valeur du plugin' } },
            ],
          }) as never,
      ),
    };

    manager.activate(pm);
    // Let the default localeName ('en') resolution settle so `_localeName` is set.
    await delay(0);

    // A plugins-change re-applies plugin locales alone (no base override after it).
    pluginsChanged?.();

    expect(locale.get('plugin-key')).toBe('Plugin value');
    expect(locale.has('skip-key')).toBe(false);
  });

  it('ignores an empty localeName without attempting a resolution', async () => {
    const { config, manager } = setup();
    const resolveMock = vi.mocked(localeRegistry.resolveLocaleDefinition);
    manager.activate(null);
    await delay(0);
    resolveMock.mockClear();

    config.set('localeName', '');
    await delay(0);

    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('applies a localeDefinitionOverride that targets the active locale', async () => {
    const { config, locale, manager } = setup();
    manager.activate(null);
    await delay(0);

    config.set('localeDefinitionOverride', { en: { 'upload-file': 'Overridden upload' } });

    expect(locale.get('upload-file')).toBe('Overridden upload');
  });

  it('ignores a localeDefinitionOverride that targets a different locale', async () => {
    const { config, locale, manager } = setup();
    manager.activate(null);
    await delay(0);
    const before = locale.get('upload-file');

    // `_localeName` is the default 'en', so an fr-targeted override must not apply.
    config.set('localeDefinitionOverride', { fr: { 'upload-file': 'Televerser un fichier' } });

    expect(locale.get('upload-file')).toBe(before);
  });

  it('applies only the second locale when its stale-but-still-in-flight predecessor resolves later — even on the default "en" path', async () => {
    const { config, locale, manager } = setup();

    let resolveEn!: (definition: Partial<LocaleDefinition>) => void;
    let resolveFr!: (definition: Partial<LocaleDefinition>) => void;
    const enPromise = new Promise<Partial<LocaleDefinition>>((resolve) => {
      resolveEn = resolve;
    });
    const frPromise = new Promise<Partial<LocaleDefinition>>((resolve) => {
      resolveFr = resolve;
    });

    const resolveMock = vi.mocked(localeRegistry.resolveLocaleDefinition);
    // First call: activate()'s initial `en` subscription fire (a real ctx's
    // default `localeName`). Second call: the rapid follow-up `fr` change.
    resolveMock.mockImplementationOnce(() => enPromise as Promise<LocaleDefinition>);
    resolveMock.mockImplementationOnce(() => frPromise as Promise<LocaleDefinition>);

    manager.activate(null); // synchronously fires cb('en') -> resolveLocaleDefinition('en')
    config.set('localeName', 'fr'); // same tick -> resolveLocaleDefinition('fr')

    // Resolve out of order: the newer ("fr") request settles first, the
    // stale ("en") one settles after. `await <promise>` here is guaranteed to
    // run after LocaleManager's own continuation on that same promise, since
    // its `.then` was registered first.
    resolveFr({ upload: 'FR upload' });
    await frPromise;
    resolveEn({ upload: 'EN stale upload' });
    await enPromise;

    expect(locale.get('upload')).toBe('FR upload');
  });
});
