import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, PluginSetupParams } from '@/index.ts';
import { createTestPlugin, renderUploader } from './utils';

describe('Custom Config', () => {
  it('should set default value from config definition', async () => {
    const plugin = createTestPlugin({
      id: 'cfg-default',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({
          name: 'myOption',
          defaultValue: 'hello',
        });
      },
    });

    await renderUploader([plugin]);

    const config = page.getByTestId('uc-config').query()! as Config;
    await expect.poll(() => config.myOption).toBe('hello');
  });

  it('should allow reading custom config via config.get()', async () => {
    let configApi: PluginSetupParams['pluginApi']['config'];
    const plugin = createTestPlugin({
      id: 'cfg-get',
      setup: ({ pluginApi }) => {
        configApi = pluginApi.config;
        pluginApi.registry.registerConfig({
          name: 'readableOption',
          defaultValue: 42,
        });
      },
    });

    await renderUploader([plugin]);

    await expect.poll(() => configApi.get('readableOption')).toBe(42);
  });

  it('should allow subscribing to custom config changes via config.subscribe()', async () => {
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

    await renderUploader([plugin]);
    const config = page.getByTestId('uc-config').query()! as Config;

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    callback.mockClear();

    // Change the value via JS property
    config.subscribedOption = 'updated';

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith('updated');
    });
  });

  it('should support setting custom config via JS property on uc-config element', async () => {
    let configApi: PluginSetupParams['pluginApi']['config'];
    const plugin = createTestPlugin({
      id: 'cfg-prop',
      setup: ({ pluginApi }) => {
        configApi = pluginApi.config;
        pluginApi.registry.registerConfig({
          name: 'jsPropOption',
          defaultValue: false,
          fromAttribute: (value) => value === 'true',
        });
      },
    });

    await renderUploader([plugin]);
    const config = page.getByTestId('uc-config').query()! as Config;

    await expect.poll(() => config.jsPropOption).toBe(false);

    config.jsPropOption = true;

    await expect.poll(() => configApi.get('jsPropOption')).toBe(true);
  });

  it('should support setting custom config via HTML attribute on uc-config element', async () => {
    let configApi: PluginSetupParams['pluginApi']['config'];
    const plugin = createTestPlugin({
      id: 'cfg-attr',
      setup: ({ pluginApi }) => {
        configApi = pluginApi.config;
        pluginApi.registry.registerConfig({
          name: 'attrOption',
          defaultValue: 'default',
          attribute: true,
          fromAttribute: (value) => value ?? 'default',
        });
      },
    });

    await renderUploader([plugin]);
    const config = page.getByTestId('uc-config').query()! as Config;

    await expect.poll(() => config.attrOption).toBe('default');

    config.setAttribute('attr-option', 'from-attribute');

    await expect.poll(() => configApi.get('attrOption')).toBe('from-attribute');
  });

  it('should auto-cleanup config subscriptions when plugin is unregistered', async () => {
    const callback = vi.fn<(value: string) => void>();

    const plugin = createTestPlugin({
      id: 'cfg-cleanup',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({
          name: 'cleanupOption',
          defaultValue: 'start',
        });
        pluginApi.config.subscribe('cleanupOption', callback);
      },
    });

    const { config } = await renderUploader([plugin]);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    callback.mockClear();

    // Unregister the plugin
    config.plugins = [];

    // Give it time to settle, then verify callback is not called for new changes
    await new Promise((resolve) => setTimeout(resolve, 100));
    callback.mockClear();

    // This should not trigger the old subscription's callback
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(callback).not.toHaveBeenCalled();
  });

  it('should use normalize() to validate/transform config values', async () => {
    const plugin = createTestPlugin({
      id: 'cfg-normalize',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({
          name: 'normalizedOption',
          defaultValue: 0,
          normalize: (value) => Math.max(0, Math.min(100, Number(value) || 0)),
        });
      },
    });

    await renderUploader([plugin]);
    const config = page.getByTestId('uc-config').query()! as Config;

    await expect.poll(() => config.normalizedOption).toBe(0);

    config.normalizedOption = 150;
    await expect.poll(() => config.normalizedOption).toBe(100);

    config.normalizedOption = -50;
    await expect.poll(() => config.normalizedOption).toBe(0);

    config.normalizedOption = 42;
    await expect.poll(() => config.normalizedOption).toBe(42);
  });

  it('should not allow setting attribute when attribute is false', async () => {
    let configApi: PluginSetupParams['pluginApi']['config'];
    const plugin = createTestPlugin({
      id: 'cfg-attr-false',
      setup: ({ pluginApi }) => {
        configApi = pluginApi.config;
        pluginApi.registry.registerConfig({
          name: 'noAttrOption',
          defaultValue: 'server',
          attribute: false,
        });
      },
    });

    await renderUploader([plugin]);
    const config = page.getByTestId('uc-config').query()! as Config;

    await expect.poll(() => configApi.get('noAttrOption')).toBe('server');

    config.setAttribute('no-attr-option', 'client');

    // Value should stay default because attribute is disabled
    await expect.poll(() => configApi.get('noAttrOption')).toBe('server');

    // JS property should still work
    config.noAttrOption = 'js-update';
    await expect.poll(() => configApi.get('noAttrOption')).toBe('js-update');
  });

  it('should warn and keep first config when duplicate name is registered', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const pluginA = createTestPlugin({
      id: 'cfg-dup-a',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({
          name: 'dupOption',
          defaultValue: 'first',
        });
      },
    });

    const pluginB = createTestPlugin({
      id: 'cfg-dup-b',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({
          name: 'dupOption',
          defaultValue: 'second',
        });
      },
    });

    await renderUploader([pluginA, pluginB]);

    const config = page.getByTestId('uc-config').query()! as Config;
    await expect.poll(() => config.dupOption).toBe('first');
    expect(warnSpy).toHaveBeenCalledWith('[CustomConfig] Config option "dupOption" is already registered');

    warnSpy.mockRestore();
  });
});

declare module '@/types/index' {
  interface CustomConfig {
    readableOption: number;
    subscribedOption: string;
    attrOption: string;
    cleanupOption: string;
    jsPropOption: boolean;
    noAttrOption: string;
    myOption: string;
    dupOption: string;
    normalizedOption: number;
  }
}
