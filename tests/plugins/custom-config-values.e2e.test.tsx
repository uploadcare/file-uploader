import { describe, expect, it, vi } from 'vitest';
import type { PluginConfigApi } from '@/index.ts';
import { createTestPlugin, renderSolution } from '~/tests/utils/render-solution';

describe('custom config: values', () => {
  it('applies defaultValue from the config definition', async () => {
    const plugin = createTestPlugin({
      id: 'cfg-default',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({
          name: 'myOption',
          defaultValue: 'hello',
        });
      },
    });

    const { config } = await renderSolution('regular', { plugins: [plugin] });

    await expect.poll(() => config.myOption).toBe('hello');
  });

  it('reads custom config through config.get()', async () => {
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

    await renderSolution('regular', { plugins: [plugin] });

    await expect.poll(() => configApi.get('readableOption')).toBe(42);
  });

  it('returns defaultValue from config.get() synchronously inside setup()', async () => {
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

    await renderSolution('regular', { plugins: [plugin] });

    await vi.waitFor(() => {
      expect(setupCalled).toBe(true);
    });

    expect(valueInsideSetup).toBe('sync-default');
  });

  it('accepts a value set as a JS property on uc-config', async () => {
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

    const { config } = await renderSolution('regular', { plugins: [plugin] });

    await expect.poll(() => config.jsPropOption).toBe(false);

    config.jsPropOption = true;

    await expect.poll(() => configApi.get('jsPropOption')).toBe(true);
  });

  it('accepts a value set as an HTML attribute on uc-config', async () => {
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

    const { config } = await renderSolution('regular', { plugins: [plugin] });

    await expect.poll(() => config.attrOption).toBe('default');

    config.setAttribute('attr-option', 'from-attribute');

    await expect.poll(() => configApi.get('attrOption')).toBe('from-attribute');
  });

  it('restores defaultValue when the HTML attribute is removed', async () => {
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

    const { config } = await renderSolution('regular', { plugins: [plugin] });

    await expect.poll(() => configApi.get('removableAttrOption')).toBe('default-qa');

    config.setAttribute('removable-attr-option', 'custom');
    await expect.poll(() => configApi.get('removableAttrOption')).toBe('custom');

    config.removeAttribute('removable-attr-option');
    await expect.poll(() => configApi.get('removableAttrOption')).toBe('default-qa');
  });

  it('ignores the HTML attribute when attribute is false', async () => {
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

    const { config } = await renderSolution('regular', { plugins: [plugin] });

    await expect.poll(() => configApi.get('noAttrOption')).toBe('server');

    config.setAttribute('no-attr-option', 'client');

    await expect.poll(() => configApi.get('noAttrOption')).toBe('server');

    config.noAttrOption = 'js-update';
    await expect.poll(() => configApi.get('noAttrOption')).toBe('js-update');
  });

  it('passes every write through normalize()', async () => {
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

    const { config } = await renderSolution('regular', { plugins: [plugin] });

    await expect.poll(() => config.normalizedOption).toBe(0);

    config.normalizedOption = 150;
    await expect.poll(() => config.normalizedOption).toBe(100);

    config.normalizedOption = -50;
    await expect.poll(() => config.normalizedOption).toBe(0);

    config.normalizedOption = 42;
    await expect.poll(() => config.normalizedOption).toBe(42);
  });

  it('warns and keeps the previous value when normalize() throws', async () => {
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

    const { config } = await renderSolution('regular', { plugins: [plugin] });

    await expect.poll(() => config.throwingNormOption).toBe('safe');

    config.throwingNormOption = 'bad';

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('normalize()'), expect.any(Error));
    });

    await expect.poll(() => config.throwingNormOption).toBe('safe');

    warnSpy.mockRestore();
  });

  it('warns and keeps the first definition when two plugins register the same name', async () => {
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

    const { config } = await renderSolution('regular', { plugins: [pluginA, pluginB] });

    await expect.poll(() => config.dupOption).toBe('first');
    expect(warnSpy).toHaveBeenCalledWith('[CustomConfig] Config option "dupOption" is already registered');

    warnSpy.mockRestore();
  });
});

declare module '@/types/index' {
  interface CustomConfig {
    myOption: string;
    readableOption: number;
    syncGetOption: string;
    jsPropOption: boolean;
    attrOption: string;
    removableAttrOption: string;
    noAttrOption: string;
    normalizedOption: number;
    throwingNormOption: string;
    dupOption: string;
  }
}
