import { describe, expect, it, vi } from 'vitest';
import { ConfigController } from './controllers/ConfigController';
import { ControllerContainer } from './di/ControllerContainer';
import type { PlainText } from './l10n';
import { PluginController, type PluginSourceRegistration } from './managers/plugin';
import { observeSources, resolveSources, type SourceButtonConfig } from './sources';

const source = (id: string, expand?: () => string[]): PluginSourceRegistration => ({
  id,
  label: `src-type-${id}` as PlainText,
  icon: id,
  onSelect: vi.fn(),
  ...(expand && { expand }),
});

describe('resolveSources', () => {
  it('lists the registered sources in sourceList order and skips unknown ids', () => {
    const sources = [source('local'), source('camera')];

    expect(resolveSources(['camera', 'nope', 'local'], sources).map((s) => s.id)).toEqual(['camera', 'local']);
  });

  it('replaces a source by what it expands to, keeping only registered ids', () => {
    const sources = [source('camera', () => ['mobile-photo', 'gone']), source('mobile-photo')];

    expect(resolveSources(['camera'], sources).map((s) => s.id)).toEqual(['mobile-photo']);
  });

  it('builds the button config from the registration, clicking through to onSelect', () => {
    const local = source('local');
    const [button] = resolveSources(['local'], [local]);

    expect(button).toMatchObject({ id: 'local', label: 'src-type-local', icon: 'local' });
    button?.onClick();
    expect(local.onSelect).toHaveBeenCalledOnce();
  });
});

describe('observeSources', () => {
  const setup = (initialSources: PluginSourceRegistration[] = [], { pluginsReady = true } = {}) => {
    const container = new ControllerContainer();
    const config = container.get(ConfigController);
    let sources = initialSources;
    let onPluginsChange: (() => void) | undefined;
    const pluginManager = {
      snapshot: () => ({ sources }),
      onPluginsChange: (cb: () => void) => {
        onPluginsChange = cb;
        return () => {
          onPluginsChange = undefined;
        };
      },
    } as unknown as PluginController;
    container.bind(PluginController, () => pluginManager);
    if (pluginsReady) container.get(PluginController);

    const emitted: SourceButtonConfig[][] = [];
    const ids = () => emitted.at(-1)?.map((s) => s.id);
    return {
      container,
      config,
      emitted,
      ids,
      observe: () => observeSources(container, (next) => emitted.push(next)),
      changePlugins: (next: PluginSourceRegistration[]) => {
        sources = next;
        onPluginsChange?.();
      },
    };
  };

  it('emits the sources for the configured sourceList at once', () => {
    const { config, ids, observe } = setup([source('local'), source('camera')]);
    config.set('sourceList', 'local, camera');

    const stop = observe();

    expect(ids()).toEqual(['local', 'camera']);
    stop();
  });

  it('re-emits when sourceList changes', () => {
    const { config, ids, observe } = setup([source('local'), source('camera')]);
    config.set('sourceList', 'local');
    const stop = observe();

    config.set('sourceList', 'local, camera');

    expect(ids()).toEqual(['local', 'camera']);
    stop();
  });

  it('does not re-emit on an unrelated config change', () => {
    const { config, emitted, observe } = setup([source('local')]);
    config.set('sourceList', 'local');
    const stop = observe();
    const count = emitted.length;

    config.set('multiple', !config.get('multiple'));

    expect(emitted.length).toBe(count);
    stop();
  });

  it('re-emits when the plugins change', () => {
    const { config, ids, observe, changePlugins } = setup([source('local')]);
    config.set('sourceList', 'local, camera');
    const stop = observe();
    expect(ids()).toEqual(['local']);

    changePlugins([source('local'), source('camera')]);

    expect(ids()).toEqual(['local', 'camera']);
    stop();
  });

  it('picks up the plugin sources once the plugin manager arrives', () => {
    const { container, config, ids, observe } = setup([source('local')], { pluginsReady: false });
    config.set('sourceList', 'local');
    const stop = observe();
    expect(ids()).toEqual([]);

    container.get(PluginController);

    expect(ids()).toEqual(['local']);
    stop();
  });

  it('stops reacting once unsubscribed', () => {
    const { config, emitted, observe, changePlugins } = setup([source('local')]);
    config.set('sourceList', 'local');
    observe()();
    const count = emitted.length;

    config.set('sourceList', '');
    changePlugins([]);

    expect(emitted.length).toBe(count);
  });
});
