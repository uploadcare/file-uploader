import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { PluginController } from '../../abstract/managers/plugin';
import { PluginRegistry } from '../../abstract/managers/plugin/PluginRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
import type { IconHrefResolver } from '../../types/index';
import { delay } from '../../utils/delay';
import { Icon } from './Icon';

// Idempotent (same path as defineComponents(UC)).
Icon.reg('uc-icon');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `icon-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const mountWithConfig = async (ctxName: string, name: string): Promise<{ el: Icon; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = PubSub.getContainer(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-icon') as Icon;
  el.setAttribute('ctx-name', ctxName);
  el.name = name;
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, config };
};

const useHref = (el: Icon): string | null | undefined => el.querySelector('svg use')?.getAttribute('href');

describe('Icon (M-god step 6b-2 migration)', () => {
  it('declares its dependency via static uses', () => {
    expect(Icon.uses).toEqual([ConfigController]);
  });

  it('renders the default sprite href for a name with no custom resolver', async () => {
    const { el } = await mountWithConfig(freshCtxName(), 'upload');
    expect(useHref(el)).toBe('#uc-icon-upload');
  });

  it('re-renders the resolved href reactively when config.iconHrefResolver changes (getTracked, no subConfigValue)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mountWithConfig(ctxName, 'upload');
    expect(useHref(el)).toBe('#uc-icon-upload');

    // External config change — no imperative subscription on the block. The
    // `iconHrefResolver` read in render() was tracked by SignalWatcher, so this
    // re-renders with the resolver's href.
    const resolver: IconHrefResolver = (name) => `https://cdn.example/${name}.svg`;
    config.set('iconHrefResolver', resolver);
    await el.updateComplete;
    await delay(0);
    expect(useHref(el)).toBe('https://cdn.example/upload.svg');

    // And back to the default when the resolver is cleared — bidirectional.
    config.set('iconHrefResolver', null);
    await el.updateComplete;
    await delay(0);
    expect(useHref(el)).toBe('#uc-icon-upload');
  });

  it('renders the empty-name early return (no sprite href) when name is unset', async () => {
    const { el } = await mountWithConfig(freshCtxName(), '');
    // The early-return branch (`!this.name`) still calls `renderIconSvg('')` —
    // an empty href, not the `#uc-icon-<name>` sprite reference — and never
    // touches `_pluginManager` at all.
    expect(useHref(el)).toBe('');
  });

  it('renders a plugin-registered icon when the plugin manager snapshot has one for this name', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const container = PubSub.getContainer(ctxName);
    if (!container) throw new Error('container not resolved');

    // A real `PluginRegistry` (rather than hand-typing `PluginRegistrySnapshot`)
    // so the snapshot shape stays correct by construction; only `snapshot`/
    // `onPluginsChange` are read by `Icon`. M-god step 9b-2: `Icon` obtains the
    // plugin manager via `whenController(PluginController)` off the container (was
    // `bag.when('pluginManager', …)`), so bind + resolve it on the container
    // (mirrors `ensurePluginManager`) — pre-resolving before mount makes the
    // waiter fire synchronously on adoption.
    const registry = new PluginRegistry(() => {});
    registry.addIcon('test-plugin', {
      name: 'custom-icon',
      svg: '<svg data-plugin-icon="true"><circle r="1"></circle></svg>',
    });
    const fakePluginManager: Pick<PluginController, 'snapshot' | 'onPluginsChange'> = {
      snapshot: () => registry.snapshot(),
      onPluginsChange: () => () => {},
    };
    container.bind(PluginController, () => fakePluginManager as unknown as PluginController);
    container.get(PluginController);

    const el = document.createElement('uc-icon') as Icon;
    el.setAttribute('ctx-name', ctxName);
    el.name = 'custom-icon';
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;

    // Plugin icon takes precedence over the sprite href — no `<use>` element.
    expect(el.querySelector('svg use')).toBeNull();
    expect(el.querySelector('svg[data-plugin-icon]')).not.toBeNull();
  });

  it('subscribes to plugin changes via whenController on resolution and unsubscribes on disconnect', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const container = PubSub.getContainer(ctxName);
    if (!container) throw new Error('container not resolved');

    const unsub = vi.fn();
    const onPluginsChange = vi.fn(() => unsub);
    const fakePluginManager = {
      snapshot: () => new PluginRegistry(() => {}).snapshot(),
      onPluginsChange,
    } as unknown as PluginController;
    container.bind(PluginController, () => fakePluginManager);

    const el = document.createElement('uc-icon') as Icon;
    el.setAttribute('ctx-name', ctxName);
    el.name = 'upload';
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;

    // whenController is pending — the PluginController is bound but not resolved.
    expect(onPluginsChange).not.toHaveBeenCalled();

    // Resolving it (mirrors `ensurePluginManager`) flushes the waiter, which
    // subscribes to plugin changes.
    container.get(PluginController);
    expect(onPluginsChange).toHaveBeenCalledOnce();

    // Disconnect tears the tracked subscription down.
    el.remove();
    expect(unsub).toHaveBeenCalledOnce();
  });
});
