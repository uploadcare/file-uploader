import { describe, expect, it, vi } from 'vitest';
import type { PluginConfigApi } from '@/index.ts';
import { delay } from '@/utils/delay';
import { createTestPlugin, renderSolution } from '~/tests/utils/render-solution';

describe('custom config: subscribe', () => {
  it('calls config.subscribe() with defaultValue first, synchronously inside setup()', async () => {
    const firstCallValue: unknown[] = [];
    const plugin = createTestPlugin({
      id: 'cfg-sync-subscribe',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({
          name: 'syncSubscribeOption',
          defaultValue: 'subscribe-default',
        });
        pluginApi.config.subscribe('syncSubscribeOption', (v) => {
          firstCallValue.push(v);
        });
      },
    });

    await renderSolution('regular', { plugins: [plugin] });

    await vi.waitFor(() => {
      expect(firstCallValue.length).toBeGreaterThan(0);
    });

    expect(firstCallValue[0]).toBe('subscribe-default');
  });

  it('notifies config.subscribe() when the value changes', async () => {
    const callback = vi.fn<(value: string) => void>();

    const plugin = createTestPlugin({
      id: 'cfg-subscribe',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({
          name: 'subscribedOption',
          defaultValue: 'initial',
        });
        pluginApi.config.subscribe('subscribedOption', callback);
      },
    });

    const { config } = await renderSolution('regular', { plugins: [plugin] });

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    callback.mockClear();

    config.subscribedOption = 'updated';

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith('updated');
    });
  });

  it('drops config subscriptions when the plugin is unregistered', async () => {
    const callback = vi.fn<(value: string) => void>();
    const dispose = vi.fn();

    const plugin = createTestPlugin({
      id: 'cfg-cleanup',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({
          name: 'cleanupOption',
          defaultValue: 'start',
        });
        pluginApi.config.subscribe('cleanupOption', callback);
        return dispose;
      },
    });

    const { config } = await renderSolution('regular', { plugins: [plugin] });

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    config.plugins = [];
    await vi.waitFor(() => {
      expect(dispose).toHaveBeenCalledOnce();
    });

    callback.mockClear();

    // Negative wait: nothing signals "the old subscription did not fire".
    await delay(100);
    expect(callback).not.toHaveBeenCalled();
  });

  it('keeps a JS property set before plugins is assigned', async () => {
    const callback = vi.fn<(value: string) => void>();
    const plugin = createTestPlugin({
      id: 'cfg-prop-before-plugins',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({
          name: 'preAssignedProp',
          defaultValue: 'default',
        });
        pluginApi.config.subscribe('preAssignedProp', callback);
      },
    });

    // Assignment order relative to `plugins` is the subject, so both land after render.
    const { config } = await renderSolution('regular');

    // Property is set BEFORE the plugin registers — there's no setter on the
    // element at this point, so it lands as an instance data property.
    config.preAssignedProp = 'pre-assigned';

    config.plugins = [plugin];

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    await expect.poll(() => callback.mock.calls.at(-1)?.[0]).toBe('pre-assigned');
    await expect.poll(() => config.preAssignedProp).toBe('pre-assigned');
  });

  it('keeps a JS property set immediately after plugins is assigned', async () => {
    // Regression test: previously, when the user set the plugin's custom
    // config property right after assigning `config.plugins`, the assignment
    // landed on the element as a data descriptor (the plugin's accessor
    // didn't yet exist because plugin.setup is awaited asynchronously). When
    // the plugin manager later registered the property accessor via
    // `Object.defineProperty`, the data descriptor was replaced and the
    // user-set value was silently lost.
    const callback = vi.fn<(value: string) => void>();
    const plugin = createTestPlugin({
      id: 'cfg-prop-after-plugins',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({
          name: 'lateAssignedProp',
          defaultValue: 'default',
        });
        pluginApi.config.subscribe('lateAssignedProp', callback);
      },
    });

    // Assignment order relative to `plugins` is the subject, so both land after render.
    const { config } = await renderSolution('regular');

    // Bug repro: assign plugins first, then set the property synchronously
    // before the async plugin registration has had a chance to install the
    // accessor descriptor. The property must still be observable after the
    // plugin finishes registering.
    config.plugins = [plugin];
    config.lateAssignedProp = 'late-assigned';

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    await expect.poll(() => callback.mock.calls.at(-1)?.[0]).toBe('late-assigned');
    await expect.poll(() => config.lateAssignedProp).toBe('late-assigned');
  });

  it('delivers an HTML attribute set before plugin registration to subscribe()', async () => {
    // Regression test: previously, an attribute on `<uc-config>` rendered
    // before the plugin registered would not flow into state. The earlier
    // `attributeChangedCallback` queued via `when('pluginManager')` would
    // run before `_processCustomConfigs` populated the attribute → key
    // mapping, so the value was dropped. Subscribers ended up seeing only
    // the plugin's defaultValue.
    const callback = vi.fn<(value: string) => void>();
    let configApi: PluginConfigApi;
    const plugin = createTestPlugin({
      id: 'cfg-attr-before-register',
      setup: ({ pluginApi }) => {
        configApi = pluginApi.config;
        pluginApi.registry.registerConfig({
          name: 'preAttrOption',
          defaultValue: 'default-value',
        });
        pluginApi.config.subscribe('preAttrOption', callback);
      },
    });

    // A string prop becomes the `pre-attr-option` attribute before connect; the plugin registers AFTER it is on the
    // element, which is the subject, so `plugins` is assigned after render.
    const { config } = await renderSolution('regular', { preAttrOption: 'from-attribute' });

    config.plugins = [plugin];

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    await expect.poll(() => callback.mock.calls.at(-1)?.[0]).toBe('from-attribute');
    await expect.poll(() => configApi.get('preAttrOption')).toBe('from-attribute');
    await expect.poll(() => config.preAttrOption).toBe('from-attribute');
  });
});

declare module '@/types/index' {
  interface CustomConfig {
    syncSubscribeOption: string;
    subscribedOption: string;
    cleanupOption: string;
    preAssignedProp: string;
    lateAssignedProp: string;
    preAttrOption: string;
  }
}
