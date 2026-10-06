import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { configAttributeBehavior } from '@/blocks/Config/Config';
import { initialConfig } from '@/blocks/Config/initialConfig';
import { type Config, defineLocale } from '@/index';
import en from '@/locales/file-uploader/en';
import type { ConfigType } from '@/types/exported';
import { delay } from '@/utils/delay';
import { toKebabCase } from '@/utils/toKebabCase';
import { createInCtx, inCtx } from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';

/**
 * Every value each option's type permits, set on a real `<uc-config>` and read
 * back.
 *
 * The unit tests under `src/blocks/Config` cover the validators directly; this
 * covers the element, which is the only surface an integrator touches. The two
 * are not interchangeable: `authToken` had a passing unit test for the
 * provider shape while the element dropped it, because that test stubbed the
 * context and so never reached the validator at all.
 *
 * `VALUES` is typed as every key of `ConfigType` mapped to an array of its own
 * type, so the compiler rejects a value an option does not allow and a new
 * option fails to compile until it is listed here.
 */

const noop = () => {};

/**
 * Only `en` ships registered; every other locale is the integrator's to add
 * through `defineLocale`. `localeName` is typed `string`, but its real domain
 * is "a locale someone registered", so the sweep registers one rather than
 * naming a locale that only exists as a file on disk.
 */
const TEST_LOCALE = 'xx-test';
defineLocale(TEST_LOCALE, en);

const VALUES: { [K in keyof ConfigType]: ConfigType[K][] } = {
  pubkey: ['', 'demopublickey'],
  multiple: [true, false],
  multipleMin: [0, 5],
  multipleMax: [1, Number.MAX_SAFE_INTEGER],
  confirmUpload: [true, false],
  imgOnly: [true, false],
  accept: ['', 'image/*', '.jpg,.png'],
  externalSourcesPreferredTypes: ['', 'image/*'],
  externalSourcesEmbedCss: ['', 'body { background: #fff }'],
  store: [true, false, 'auto'],
  cameraMirror: [true, false],
  cameraCapture: ['', 'user', 'environment'],
  sourceList: ['', 'local', 'local, url, camera'],
  topLevelOrigin: ['', 'https://example.com'],
  maxLocalFileSizeBytes: [0, 1024 * 1024],
  thumbSize: [76, 120],
  showEmptyList: [true, false],
  useLocalImageEditor: [true, false],
  useCloudImageEditor: [true, false],
  cloudImageEditorTabs: ['crop', 'crop, tuning, filters'],
  removeCopyright: [true, false],
  cropPreset: ['', '1:1', '16:9 4:3'],
  imageShrink: ['', '1024x1024 90%'],
  modalScrollLock: [true, false],
  modalBackdropStrokes: [true, false],
  sourceListWrap: [true, false],
  remoteTabSessionKey: ['', 'session-key'],
  // The default is deliberately absent: holding it is the signal that asks
  // `computed-properties` to swap in the pubkey-prefixed CDN base, so it is
  // the one value that does not read back as it was set.
  cdnCname: ['https://cdn.example.com'],
  cdnCnamePrefixed: ['https://ucarecd.net', 'https://cdn.example.com'],
  baseUrl: ['https://upload.uploadcare.com', 'https://upload.example.com'],
  socialBaseUrl: ['https://social.uploadcare.com', 'https://social.example.com'],
  secureSignature: ['', 'deadbeef'],
  secureExpire: ['', '1700000000'],
  secureDeliveryProxy: ['', 'https://proxy.example.com/{previewUrl}'],
  retryThrottledRequestMaxTimes: [0, 3],
  retryNetworkErrorMaxTimes: [0, 3],
  multipartMinFileSize: [0, 26214400],
  multipartChunkSize: [1, 5242880],
  maxConcurrentRequests: [1, 10],
  multipartMaxConcurrentRequests: [1, 4],
  multipartMaxAttempts: [1, 3],
  checkForUrlDuplicates: [true, false],
  saveUrlForRecurrentUploads: [true, false],
  groupOutput: [true, false],
  userAgentIntegration: ['', 'MyApp/1.0'],
  debug: [true, false],
  localeName: ['en', TEST_LOCALE],
  secureUploadsExpireThreshold: [0, 600000],
  plugins: [[]],

  metadata: [{}, { subject: 'id-card' }, () => ({ subject: 'id-card' }), async () => ({ subject: 'id-card' }), null],
  tags: [[], ['one', 'two'], () => ['one'], async () => ['one'], null],
  localeDefinitionOverride: [{}, { en: { 'upload-file': 'Upload' } }, null],
  secureUploadsSignatureResolver: [async () => ({ secureSignature: 'sig', secureExpire: 'exp' }), null],
  authToken: [
    'eyJ.plain.sig',
    () => 'eyJ',
    async () => 'eyJ',
    { getToken: () => 'eyJ' },
    { getToken: async () => 'eyJ', invalidate: noop },
    null,
  ],
  secureDeliveryProxyUrlResolver: [async () => 'https://proxy.example.com/x', null],
  iconHrefResolver: [(iconName: string) => `#icon-${iconName}`, null],
  fileValidators: [[], [() => undefined]],
  collectionValidators: [[], [() => undefined]],
  validationTimeout: [0, 15000],
  validationConcurrency: [1, 100],

  cameraModes: ['photo', 'video', 'photo, video', 'video, photo'],
  defaultCameraMode: ['photo', 'video', null],
  enableAudioRecording: [true, false],
  enableVideoRecording: [true, false, null],
  maxVideoRecordingDuration: [0, 30, null],
  mediaRecorderOptions: [{}, { mimeType: 'video/webm' }, null],

  filesViewMode: ['grid', 'list'],
  gridShowFileNames: [true, false],
  cloudImageEditorAutoOpen: [true, false],
  qualityInsights: [true, false],
  cloudImageEditorMaskHref: ['https://example.com/mask.svg', null],
  testMode: [true, false],
  pasteScope: ['local', 'global', false],
  dynamicButtonViewMode: ['auto', 'menu', 'toolbar', 'compact', 'plain'],
  dynamicButtonShowFirstIcon: [true, false],
};

const keys = Object.keys(VALUES) as (keyof ConfigType)[];

const isPropertyOnly = (key: keyof ConfigType): boolean =>
  (configAttributeBehavior as Record<string, { attribute?: boolean } | undefined>)[key]?.attribute === false;

/** `<uc-config>` on its own: no uploader, so nothing reacts to a value and each option is read back in isolation. */
const mountConfig = async (attrs: Record<string, string> = {}): Promise<Config> => {
  const ctxName = getCtxName();
  const config = createInCtx<Config>('uc-config', ctxName, {
    pubkey: 'demopublickey',
    'test-mode': 'true',
    'quality-insights': 'false',
    ...attrs,
  });

  page.render(<div ctx-name={ctxName}></div>);
  inCtx('div', ctxName).append(config);
  await delay(0);

  return config;
};

describe('the table matches ConfigType', () => {
  it('lists every option', () => {
    // `VALUES` is a required mapped type, so a missing key is a compile error.
    // This catches the other direction: a key listed here that the element
    // does not actually ship.
    expect(keys.sort()).toEqual(Object.keys(initialConfig).sort());
  });

  it('gives every option at least one value', () => {
    expect(keys.filter((key) => VALUES[key].length === 0)).toEqual([]);
  });
});

describe('accepts every value its type describes, as a property', () => {
  for (const key of keys) {
    // Wrapped in a tuple: `it.each` spreads a top-level array into arguments,
    // which would unwrap the array-valued options into nothing.
    it.each((VALUES[key] as unknown[]).map((value) => [value]))(`${key} = %o`, async (value) => {
      const config = await mountConfig();
      const errors: unknown[][] = [];
      const original = console.error;
      console.error = (...args: unknown[]) => errors.push(args);

      try {
        (config as unknown as Record<string, unknown>)[key] = value;

        if (value === null) {
          // A rejected value also reads back as the default, so the assertion
          // below only means anything together with the empty `errors`.
          expect((config as unknown as Record<string, unknown>)[key] ?? null).toBeNull();
        } else {
          expect((config as unknown as Record<string, unknown>)[key]).toEqual(value);
        }
        // `normalizeConfigValue` reports a rejected value here rather than
        // throwing, so without this a dropped value looks like a pass.
        expect(errors).toEqual([]);
      } finally {
        console.error = original;
      }
    });
  }
});

describe('accepts the attribute form of every option that has one', () => {
  const attributeCases = keys
    .filter((key) => !isPropertyOnly(key))
    .flatMap((key) =>
      (VALUES[key] as unknown[])
        // Only primitives survive the trip through an attribute; the rest are
        // property-only by nature and are covered above.
        .filter((value) => ['string', 'number', 'boolean'].includes(typeof value))
        .map((value) => [key, String(value), value] as const),
    );

  it.each(attributeCases)('%s="%s"', async (key, attribute, expected) => {
    // Set before connection, which is how a page writes them and the only
    // route that exercises the string coercion React and Vue produce.
    const config = await mountConfig({ [toKebabCase(key)]: attribute });

    expect((config as unknown as Record<string, unknown>)[key]).toEqual(expected);
  });
});
