import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ComputedPropertyControllers, computeProperty } from './computed-properties';
import type { LazyPluginEntryFactory } from './lazyPluginRegistry';

// biome-ignore lint/suspicious/noExplicitAny: test helper
type AnyRecord = Record<string, any>;
// biome-ignore lint/suspicious/noExplicitAny: test helper
const makeGetter = (values: AnyRecord) => (key: string) => values[key] as any;

const testLazyPlugins: LazyPluginEntryFactory = ({ useCloudImageEditor, imageShrink }) => [
  {
    pluginId: 'cloud-image-editor',
    isEnabled: () => !!useCloudImageEditor(),
    load: async () => ({ id: 'cloud-image-editor', version: '0.1.0', setup: vi.fn() }),
  },
  {
    pluginId: 'image-shrink',
    isEnabled: () => !!imageShrink(),
    load: async () => ({ id: 'image-shrink', version: '0.1.0', setup: vi.fn() }),
  },
];

describe('computeProperty', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('cameraModes / enableVideoRecording', () => {
    it('adds video when enableVideoRecording is true and video not present', () => {
      const setValue = vi.fn();
      computeProperty({
        key: 'enableVideoRecording',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: setValue as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ enableVideoRecording: true, cameraModes: 'photo' }) as any,
        computationControllers: new Map(),
        getLazyPluginEntries: () => [],
      });
      expect(setValue).toHaveBeenCalledWith('cameraModes', 'photo,video');
    });

    it('removes video when enableVideoRecording is false', () => {
      const setValue = vi.fn();
      computeProperty({
        key: 'enableVideoRecording',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: setValue as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ enableVideoRecording: false, cameraModes: 'photo,video' }) as any,
        computationControllers: new Map(),
        getLazyPluginEntries: () => [],
      });
      expect(setValue).toHaveBeenCalledWith('cameraModes', 'photo');
    });

    it('returns cameraModes unchanged when enableVideoRecording is null', () => {
      const setValue = vi.fn();
      computeProperty({
        key: 'enableVideoRecording',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: setValue as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ enableVideoRecording: null, cameraModes: 'photo,video' }) as any,
        computationControllers: new Map(),
        getLazyPluginEntries: () => [],
      });
      expect(setValue).toHaveBeenCalledWith('cameraModes', 'photo,video');
    });
  });

  describe('cameraModes / defaultCameraMode', () => {
    it('reorders cameraModes to put defaultCameraMode first', () => {
      const setValue = vi.fn();
      computeProperty({
        key: 'defaultCameraMode',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: setValue as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ defaultCameraMode: 'video', cameraModes: 'photo,video' }) as any,
        computationControllers: new Map(),
        getLazyPluginEntries: () => [],
      });
      expect(setValue).toHaveBeenCalledWith('cameraModes', 'video,photo');
    });

    it('returns cameraModes unchanged when defaultCameraMode is null', () => {
      const setValue = vi.fn();
      computeProperty({
        key: 'defaultCameraMode',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: setValue as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ defaultCameraMode: null, cameraModes: 'photo,video' }) as any,
        computationControllers: new Map(),
        getLazyPluginEntries: () => [],
      });
      expect(setValue).toHaveBeenCalledWith('cameraModes', 'photo,video');
    });
  });

  describe('plugins / imageShrink', () => {
    it('adds imageShrinkPlugin when imageShrink is set', async () => {
      const setValue = vi.fn();
      computeProperty({
        key: 'imageShrink',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: setValue as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ imageShrink: '800x600', plugins: [] }) as any,
        computationControllers: new Map(),
        getLazyPluginEntries: testLazyPlugins,
      });
      await vi.waitFor(() => {
        expect(setValue).toHaveBeenCalledWith('plugins', [expect.objectContaining({ id: 'image-shrink' })]);
      });
    });

    it('removes imageShrinkPlugin when imageShrink is cleared', async () => {
      const setValue = vi.fn();
      const existingPlugin = { id: 'image-shrink', version: '0.1.0', setup: vi.fn() };
      computeProperty({
        key: 'imageShrink',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: setValue as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ imageShrink: '', plugins: [existingPlugin] }) as any,
        computationControllers: new Map(),
        getLazyPluginEntries: testLazyPlugins,
      });
      await vi.waitFor(() => {
        expect(setValue).toHaveBeenCalledWith('plugins', []);
      });
    });

    it('does not load imageShrinkPlugin if already present in plugins', async () => {
      const setValue = vi.fn();
      const existingPlugin = { id: 'image-shrink', version: '0.1.0', setup: vi.fn() };
      computeProperty({
        key: 'imageShrink',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: setValue as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ imageShrink: '800x600', plugins: [existingPlugin] }) as any,
        computationControllers: new Map(),
        getLazyPluginEntries: testLazyPlugins,
      });
      await vi.waitFor(() => {
        expect(setValue).toHaveBeenCalledWith('plugins', [existingPlugin]);
      });
    });

    it('does not call setValue when computation is aborted before load resolves', async () => {
      const setValue = vi.fn();
      const computationControllers: ComputedPropertyControllers = new Map();

      computeProperty({
        key: 'imageShrink',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: setValue as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ imageShrink: '800x600', plugins: [] }) as any,
        computationControllers,
        getLazyPluginEntries: testLazyPlugins,
      });

      // Abort by triggering a second computation — this aborts the first controller
      computeProperty({
        key: 'imageShrink',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: setValue as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ imageShrink: '', plugins: [] }) as any,
        computationControllers,
        getLazyPluginEntries: testLazyPlugins,
      });

      await vi.waitFor(() => expect(setValue).toHaveBeenCalledOnce());
      // Only the second (empty imageShrink → remove) computation should have called setValue
      expect(setValue).toHaveBeenCalledWith('plugins', []);
    });

    it('stores and replaces AbortController per computation key', () => {
      const computationControllers: ComputedPropertyControllers = new Map();

      computeProperty({
        key: 'imageShrink',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: vi.fn() as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ imageShrink: '800x600', plugins: [] }) as any,
        computationControllers,
        getLazyPluginEntries: testLazyPlugins,
      });

      const firstController = [...computationControllers.values()][0];
      expect(firstController).toBeDefined();

      computeProperty({
        key: 'imageShrink',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: vi.fn() as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ imageShrink: '1024x768', plugins: [] }) as any,
        computationControllers,
        getLazyPluginEntries: testLazyPlugins,
      });

      expect(firstController?.signal.aborted).toBe(true);
      expect([...computationControllers.values()][0]).not.toBe(firstController);
    });
  });

  describe('plugins / useCloudImageEditor', () => {
    it('adds cloudImageEditorPlugin when useCloudImageEditor is true', async () => {
      const setValue = vi.fn();
      computeProperty({
        key: 'useCloudImageEditor',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: setValue as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ useCloudImageEditor: true, plugins: [] }) as any,
        computationControllers: new Map(),
        getLazyPluginEntries: testLazyPlugins,
      });
      await vi.waitFor(() => {
        expect(setValue).toHaveBeenCalledWith('plugins', [expect.objectContaining({ id: 'cloud-image-editor' })]);
      });
    });

    it('removes cloudImageEditorPlugin when useCloudImageEditor is false', async () => {
      const setValue = vi.fn();
      const existingPlugin = { id: 'cloud-image-editor', version: '0.1.0', setup: vi.fn() };
      computeProperty({
        key: 'useCloudImageEditor',
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        setValue: setValue as any,
        // biome-ignore lint/suspicious/noExplicitAny: test helper
        getValue: makeGetter({ useCloudImageEditor: false, plugins: [existingPlugin] }) as any,
        computationControllers: new Map(),
        getLazyPluginEntries: testLazyPlugins,
      });
      await vi.waitFor(() => {
        expect(setValue).toHaveBeenCalledWith('plugins', []);
      });
    });
  });
});
