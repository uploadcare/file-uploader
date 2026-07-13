import { describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../controllers/ConfigController';
import { LocaleController } from '../controllers/LocaleController';
import { LocaleManager } from './LocaleManager';
import type { PluginController } from './plugin';

type FakePluginManager = Pick<PluginController, 'onPluginsChange' | 'snapshot'>;

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
    const config = new ConfigController();
    const locale = new LocaleController();
    const manager = new LocaleManager({ config, locale });
    const subscribeSpy = vi.spyOn(config, 'subscribe');

    manager.activate(null);
    const afterFirst = subscribeSpy.mock.calls.length;
    // localeName + localeDefinitionOverride — exactly two subscriptions wired.
    expect(afterFirst).toBe(2);

    manager.activate(null);
    manager.activate(null);

    expect(subscribeSpy).toHaveBeenCalledTimes(afterFirst);
  });

  it('is idempotent: a second activate() does not re-seed the en dictionary over a value set since', () => {
    const config = new ConfigController();
    const locale = new LocaleController();
    const manager = new LocaleManager({ config, locale });

    manager.activate(null);
    // Simulate a value having changed since first activation (e.g. a plugin
    // override, or the app writing a custom translation directly).
    locale.set('upload', 'Custom upload label');

    manager.activate(null);

    expect(locale.get('upload')).toBe('Custom upload label');
  });

  it('re-couples to a new plugin manager on re-activate without stacking the old subscription', () => {
    const config = new ConfigController();
    const locale = new LocaleController();
    const manager = new LocaleManager({ config, locale });

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

  it('destroy() releases the config subscriptions and the plugin coupling: subsequent changes produce no callbacks', () => {
    const config = new ConfigController();
    const locale = new LocaleController();
    const manager = new LocaleManager({ config, locale });

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
    const config = new ConfigController();
    const locale = new LocaleController();
    const manager = new LocaleManager({ config, locale });

    expect(() => manager.destroy()).not.toThrow();
  });
});
