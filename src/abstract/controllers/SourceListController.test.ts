import type { ReactiveControllerHost } from 'lit';
import { describe, expect, it, vi } from 'vitest';
import type { SourceButtonConfig } from '../../blocks/SourceBtn/SourceBtn';
import { ControllerContainer } from '../di/ControllerContainer';
import { PluginController, type PluginSourceRegistration } from '../managers/plugin';
import { ConfigController } from './ConfigController';
import { SourceListController } from './SourceListController';

// M-god step 7: `SourceListController` reads the `sourceList` config key directly
// off an injected `ConfigController` (was `ctx.sub(sharedConfigKey('sourceList'))`).
// M-god step 9b-1: the plugin manager is resolved off the ctx's
// `ControllerContainer` (`whenController`/`getOrNull(PluginController)`) instead
// of the `bag`. These specs pin the immediate-then-deduped per-key subscription
// semantics.
const makePluginSource = (id: string): PluginSourceRegistration => ({
  id,
  label: id,
  icon: id,
  onSelect: vi.fn(),
});

const setup = (initialSources: PluginSourceRegistration[] = []) => {
  const host = { addController: vi.fn() } as unknown as ReactiveControllerHost;
  const config = new ConfigController();
  let onPluginsChange: (() => void) | undefined;
  const pluginManager = {
    snapshot: () => ({ sources: initialSources }),
    onPluginsChange: (cb: () => void) => {
      onPluginsChange = cb;
      return () => {
        onPluginsChange = undefined;
      };
    },
  } as unknown as PluginController;
  const container = new ControllerContainer();
  container.bind(PluginController, () => pluginManager);
  // Construct it now so `whenController` fires synchronously and `getOrNull`
  // resolves — the shape a scope where `ensurePluginManager` has already run.
  container.get(PluginController);

  const emitted: SourceButtonConfig[][] = [];
  const controller = new SourceListController(host, {
    config,
    container,
    onSourcesChange: (sources) => emitted.push(sources),
  });
  return { controller, config, emitted, triggerPluginsChange: () => onPluginsChange?.() };
};

describe('SourceListController (direct ConfigController)', () => {
  it('emits sources for the configured sourceList on connect', () => {
    const { controller, config, emitted } = setup([makePluginSource('local'), makePluginSource('camera')]);
    config.set('sourceList', 'local, camera');
    controller.hostConnected();
    const last = emitted.at(-1);
    expect(last?.map((s) => s.id)).toEqual(['local', 'camera']);
    controller.hostDisconnected();
  });

  it('re-emits when the sourceList config value changes', () => {
    const { controller, config, emitted } = setup([makePluginSource('local'), makePluginSource('camera')]);
    config.set('sourceList', 'local');
    controller.hostConnected();
    expect(emitted.at(-1)?.map((s) => s.id)).toEqual(['local']);

    config.set('sourceList', 'local, camera');
    expect(emitted.at(-1)?.map((s) => s.id)).toEqual(['local', 'camera']);
    controller.hostDisconnected();
  });

  it('does not re-emit on an unrelated config change (per-key dedup)', () => {
    const { controller, config, emitted } = setup([makePluginSource('local')]);
    config.set('sourceList', 'local');
    controller.hostConnected();
    const countAfterConnect = emitted.length;

    // A change to a different config key must not fire the sourceList handler.
    config.set('multiple', !config.get('multiple'));
    expect(emitted.length).toBe(countAfterConnect);
    controller.hostDisconnected();
  });

  it('stops reacting to config changes after hostDisconnected', () => {
    const { controller, config, emitted } = setup([makePluginSource('local')]);
    config.set('sourceList', 'local');
    controller.hostConnected();
    controller.hostDisconnected();
    const countAfterDisconnect = emitted.length;

    config.set('sourceList', '');
    expect(emitted.length).toBe(countAfterDisconnect);
  });
});
