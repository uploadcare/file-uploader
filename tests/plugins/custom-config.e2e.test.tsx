import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, PluginConfigApi } from '@/index.ts';
import { delay } from '@/utils/delay';
import { getCtxName } from '../utils/test-renderer';
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
    let configApi: PluginConfigApi;
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

  it('should return defaultValue from config.get() synchronously inside setup()', async () => {
    let valueInsideSetup: unknown = 'not-set';
    let setupCalled = false;
    const plugin = createTestPlugin({
      id: 'cfg-sync-get',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({
          name: 'syncGetOption',
          defaultValue: 'sync-default',
        });
        valueInsideSetup = pluginApi.config.get('syncGetOption');
        setupCalled = true;
      },
    });

    await renderUploader([plugin]);

    // Wait for setup() to complete (it's called asynchronously after config.plugins is set)
    await vi.waitFor(() => {
      expect(setupCalled).toBe(true);
    });

    expect(valueInsideSetup).toBe('sync-default');
  });

  it('should call config.subscribe() with defaultValue as first value inside setup()', async () => {
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

    await renderUploader([plugin]);

    await vi.waitFor(() => {
      expect(firstCallValue.length).toBeGreaterThan(0);
    });

    expect(firstCallValue[0]).toBe('subscribe-default');
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
    let configApi: PluginConfigApi;
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
    let configApi: PluginConfigApi;
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

  it('should restore defaultValue when HTML attribute is removed', async () => {
    let configApi: PluginConfigApi;
    const plugin = createTestPlugin({
      id: 'cfg-attr-remove',
      setup: ({ pluginApi }) => {
        configApi = pluginApi.config;
        pluginApi.registry.registerConfig({
          name: 'removableAttrOption',
          defaultValue: 'default-qa',
          attribute: true,
        });
      },
    });

    await renderUploader([plugin]);
    const config = page.getByTestId('uc-config').query()! as Config;

    await expect.poll(() => configApi.get('removableAttrOption')).toBe('default-qa');

    config.setAttribute('removable-attr-option', 'custom');
    await expect.poll(() => configApi.get('removableAttrOption')).toBe('custom');

    config.removeAttribute('removable-attr-option');
    await expect.poll(() => configApi.get('removableAttrOption')).toBe('default-qa');
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
    await delay(100);
    callback.mockClear();

    // This should not trigger the old subscription's callback
    await delay(100);
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

  it('should warn and keep previous value when normalize() throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const plugin = createTestPlugin({
      id: 'cfg-normalize-throw',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({
          name: 'throwingNormOption',
          defaultValue: 'safe',
          normalize: (value) => {
            if (value === 'bad') throw new Error('normalize error');
            return String(value);
          },
        });
      },
    });

    await renderUploader([plugin]);
    const config = page.getByTestId('uc-config').query()! as Config;

    await expect.poll(() => config.throwingNormOption).toBe('safe');

    config.throwingNormOption = 'bad';

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('normalize()'), expect.any(Error));
    });

    // Value should remain unchanged
    await expect.poll(() => config.throwingNormOption).toBe('safe');

    warnSpy.mockRestore();
  });

  it('should not allow setting attribute when attribute is false', async () => {
    let configApi: PluginConfigApi;
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

  it('should preserve a JS property set BEFORE plugins is assigned', async () => {
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

    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode debug></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    await delay(0);
    const config = page.getByTestId('uc-config').query()! as Config;

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

  it('should preserve a JS property set IMMEDIATELY AFTER plugins is assigned', async () => {
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

    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode debug></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    await delay(0);
    const config = page.getByTestId('uc-config').query()! as Config;

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

  it('should reflect an HTML attribute set BEFORE plugin registration in subscribe', async () => {
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

    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config
          qualityInsights={false}
          ctx-name={ctxName}
          pubkey="demopublickey"
          testMode
          debug
          pre-attr-option="from-attribute"
        ></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    await delay(0);
    const config = page.getByTestId('uc-config').query()! as Config;

    // Plugin registers AFTER the attribute is already on the element.
    config.plugins = [plugin];

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    await expect.poll(() => callback.mock.calls.at(-1)?.[0]).toBe('from-attribute');
    await expect.poll(() => configApi.get('preAttrOption')).toBe('from-attribute');
    await expect.poll(() => config.preAttrOption).toBe('from-attribute');
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
    syncGetOption: string;
    syncSubscribeOption: string;
    removableAttrOption: string;
    throwingNormOption: string;
    preAssignedProp: string;
    lateAssignedProp: string;
    preAttrOption: string;
  }
}
