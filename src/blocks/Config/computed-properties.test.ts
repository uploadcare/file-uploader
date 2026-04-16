import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeProperty } from './computed-properties';

type AnyRecord = Record<string, any>;
const makeGetter = (values: AnyRecord) => (key: string) => values[key] as any;

describe('computeProperty', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('cameraModes / enableVideoRecording', () => {
    it('adds video when enableVideoRecording is true and video not present', () => {
      const setValue = vi.fn();
      computeProperty({
        key: 'enableVideoRecording',
        setValue: setValue as any,
        getValue: makeGetter({ enableVideoRecording: true, cameraModes: 'photo' }) as any,
        computationControllers: new Map(),
      });
      expect(setValue).toHaveBeenCalledWith('cameraModes', 'photo,video');
    });

    it('removes video when enableVideoRecording is false', () => {
      const setValue = vi.fn();
      computeProperty({
        key: 'enableVideoRecording',
        setValue: setValue as any,
        getValue: makeGetter({ enableVideoRecording: false, cameraModes: 'photo,video' }) as any,
        computationControllers: new Map(),
      });
      expect(setValue).toHaveBeenCalledWith('cameraModes', 'photo');
    });

    it('returns cameraModes unchanged when enableVideoRecording is null', () => {
      const setValue = vi.fn();
      computeProperty({
        key: 'enableVideoRecording',
        setValue: setValue as any,
        getValue: makeGetter({ enableVideoRecording: null, cameraModes: 'photo,video' }) as any,
        computationControllers: new Map(),
      });
      expect(setValue).toHaveBeenCalledWith('cameraModes', 'photo,video');
    });
  });

  describe('cameraModes / defaultCameraMode', () => {
    it('reorders cameraModes to put defaultCameraMode first', () => {
      const setValue = vi.fn();
      computeProperty({
        key: 'defaultCameraMode',
        setValue: setValue as any,
        getValue: makeGetter({ defaultCameraMode: 'video', cameraModes: 'photo,video' }) as any,
        computationControllers: new Map(),
      });
      expect(setValue).toHaveBeenCalledWith('cameraModes', 'video,photo');
    });

    it('returns cameraModes unchanged when defaultCameraMode is null', () => {
      const setValue = vi.fn();
      computeProperty({
        key: 'defaultCameraMode',
        setValue: setValue as any,
        getValue: makeGetter({ defaultCameraMode: null, cameraModes: 'photo,video' }) as any,
        computationControllers: new Map(),
      });
      expect(setValue).toHaveBeenCalledWith('cameraModes', 'photo,video');
    });
  });
});
