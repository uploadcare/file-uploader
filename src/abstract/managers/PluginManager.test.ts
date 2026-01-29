import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { LitSolutionBlock } from '../../lit/LitSolutionBlock';
import type { Plugin } from '../Plugin';
import { PluginManager } from './PluginManager';

describe('PluginManager', () => {
  let mockSolution: LitSolutionBlock;
  let pluginManager: PluginManager;

  beforeEach(() => {
    // Create a minimal mock solution instead of instantiating the real class
    mockSolution = {
      $: {},
      cfg: {},
    } as unknown as LitSolutionBlock;

    pluginManager = new PluginManager(mockSolution);
  });

  test('should register a plugin', () => {
    const plugin: Plugin = {
      pluginId: 'test-plugin',
      init: vi.fn(),
    };

    pluginManager.register({ plugin });

    expect(pluginManager.hasPlugin('test-plugin')).toBe(true);
    expect(pluginManager.getPlugin('test-plugin')).toBe(plugin);
  });

  test('should not register duplicate plugins', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plugin: Plugin = {
      pluginId: 'test-plugin',
      init: vi.fn(),
    };

    pluginManager.register({ plugin });
    pluginManager.register({ plugin });

    expect(consoleSpy).toHaveBeenCalledWith('Plugin "test-plugin" is already registered');
    expect(pluginManager.hasPlugin('test-plugin')).toBe(true);

    consoleSpy.mockRestore();
  });

  test('should initialize plugins', () => {
    const initSpy = vi.fn();
    const plugin: Plugin = {
      pluginId: 'test-plugin',
      init: initSpy,
    };

    pluginManager.register({ plugin });
    pluginManager.initPlugins();

    expect(initSpy).toHaveBeenCalledWith(mockSolution);
  });

  test('should initialize plugins only once', () => {
    const initSpy = vi.fn();
    const plugin: Plugin = {
      pluginId: 'test-plugin',
      init: initSpy,
    };

    pluginManager.register({ plugin });
    pluginManager.initPlugins();
    pluginManager.initPlugins();

    expect(initSpy).toHaveBeenCalledTimes(1);
  });

  test('should call destroy on plugins', () => {
    const destroySpy = vi.fn();
    const plugin: Plugin = {
      pluginId: 'test-plugin',
      init: vi.fn(),
      destroy: destroySpy,
    };

    pluginManager.register({ plugin });
    pluginManager.initPlugins();
    pluginManager.destroyPlugins();

    expect(destroySpy).toHaveBeenCalled();
  });

  test('should handle plugins without destroy method', () => {
    const plugin: Plugin = {
      pluginId: 'test-plugin',
      init: vi.fn(),
    };

    pluginManager.register({ plugin });
    pluginManager.initPlugins();

    expect(() => pluginManager.destroyPlugins()).not.toThrow();
  });

  test('should initialize plugin immediately if manager is already initialized', () => {
    const initSpy = vi.fn();

    pluginManager.initPlugins();

    const plugin: Plugin = {
      pluginId: 'test-plugin',
      init: initSpy,
    };

    pluginManager.register({ plugin });

    expect(initSpy).toHaveBeenCalledWith(mockSolution);
  });

  test('should handle errors during plugin initialization', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const plugin: Plugin = {
      pluginId: 'test-plugin',
      init: () => {
        throw new Error('Init failed');
      },
    };

    pluginManager.register({ plugin });

    expect(() => pluginManager.initPlugins()).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('should handle errors during plugin destruction', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const plugin: Plugin = {
      pluginId: 'test-plugin',
      init: vi.fn(),
      destroy: () => {
        throw new Error('Destroy failed');
      },
    };

    pluginManager.register({ plugin });
    pluginManager.initPlugins();

    expect(() => pluginManager.destroyPlugins()).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('should clear all plugins after destroy', () => {
    const plugin: Plugin = {
      pluginId: 'test-plugin',
      init: vi.fn(),
    };

    pluginManager.register({ plugin });
    pluginManager.initPlugins();
    pluginManager.destroyPlugins();

    expect(pluginManager.hasPlugin('test-plugin')).toBe(false);
  });
});
