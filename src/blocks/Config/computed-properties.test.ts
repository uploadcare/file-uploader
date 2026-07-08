import { getPrefixedCdnBaseSync } from '@uploadcare/cname-prefix/sync';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ComputedPropertyValues, computeProperty } from './computed-properties';
import { DEFAULT_CDN_CNAME, DEFAULT_PREFIXED_CDN_BASE_DOMAIN } from './initialConfig';

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
        computedValues: new Map(),
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
        computedValues: new Map(),
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
        computedValues: new Map(),
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
        computedValues: new Map(),
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
        computedValues: new Map(),
      });
      expect(setValue).toHaveBeenCalledWith('cameraModes', 'photo,video');
    });
  });

  describe('cdnCname / pubkey', () => {
    const derived = (pubkey: string) => getPrefixedCdnBaseSync(pubkey, DEFAULT_PREFIXED_CDN_BASE_DOMAIN);

    const computeCdnCname = (values: AnyRecord, computedValues: ComputedPropertyValues = new Map()) => {
      const setValue = vi.fn();
      computeProperty({
        key: 'pubkey',
        setValue: setValue as any,
        getValue: makeGetter({ cdnCnamePrefixed: DEFAULT_PREFIXED_CDN_BASE_DOMAIN, ...values }) as any,
        computationControllers: new Map(),
        computedValues,
      });
      return setValue;
    };

    it('derives the prefixed base when cdnCname is the default', async () => {
      const setValue = computeCdnCname({ pubkey: 'demopublickey', cdnCname: DEFAULT_CDN_CNAME });
      await vi.waitFor(() => expect(setValue).toHaveBeenCalledWith('cdnCname', derived('demopublickey')));
    });

    it('derives the prefixed base when cdnCname is the prefixed zone apex', async () => {
      const setValue = computeCdnCname({ pubkey: 'demopublickey', cdnCname: 'https://ucarecd.net' });
      await vi.waitFor(() => expect(setValue).toHaveBeenCalledWith('cdnCname', derived('demopublickey')));
    });

    it('keeps a dedicated domain inside the prefixed zone verbatim', () => {
      const setValue = computeCdnCname({ pubkey: 'demopublickey', cdnCname: 'https://custom.ucarecd.net' });
      expect(setValue).toHaveBeenCalledWith('cdnCname', 'https://custom.ucarecd.net');
    });

    it('keeps a dedicated domain on a sub-zone verbatim', () => {
      const setValue = computeCdnCname({ pubkey: 'demopublickey', cdnCname: 'https://1nnim0cit9.s.ucarecd.net' });
      expect(setValue).toHaveBeenCalledWith('cdnCname', 'https://1nnim0cit9.s.ucarecd.net');
    });

    it('keeps a custom CNAME verbatim', () => {
      const setValue = computeCdnCname({ pubkey: 'demopublickey', cdnCname: 'https://cdn.example.com' });
      expect(setValue).toHaveBeenCalledWith('cdnCname', 'https://cdn.example.com');
    });

    it('re-derives its own previously computed value when pubkey changes', async () => {
      const computedValues: ComputedPropertyValues = new Map();
      const values: AnyRecord = { pubkey: 'first-key', cdnCname: DEFAULT_CDN_CNAME };

      const firstSetValue = computeCdnCname(values, computedValues);
      await vi.waitFor(() => expect(firstSetValue).toHaveBeenCalledWith('cdnCname', derived('first-key')));

      // The computed value is written back into the config; a pubkey change
      // must re-derive it instead of treating it as a user-provided domain.
      values.cdnCname = derived('first-key');
      values.pubkey = 'second-key';
      const secondSetValue = computeCdnCname(values, computedValues);
      await vi.waitFor(() => expect(secondSetValue).toHaveBeenCalledWith('cdnCname', derived('second-key')));
    });

    it('does not clobber a dedicated domain when pubkey changes', () => {
      const computedValues: ComputedPropertyValues = new Map();
      const values: AnyRecord = { pubkey: 'first-key', cdnCname: 'https://custom.ucarecd.net' };

      const firstSetValue = computeCdnCname(values, computedValues);
      expect(firstSetValue).toHaveBeenCalledWith('cdnCname', 'https://custom.ucarecd.net');

      // The verbatim pass-through above must not be recorded as the
      // property's own output, so a pubkey change keeps it untouched.
      values.pubkey = 'second-key';
      const secondSetValue = computeCdnCname(values, computedValues);
      expect(secondSetValue).toHaveBeenCalledWith('cdnCname', 'https://custom.ucarecd.net');
    });
  });
});
