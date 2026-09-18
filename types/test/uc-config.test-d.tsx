import { expectTypeOf, test } from 'vitest';
import type {
  Config,
  ConfigAttributesType,
  FileValidatorDescriptor,
  FuncCollectionValidator,
  FuncFileValidator,
  OutputFileEntry,
} from '../../dist/index';
import '../jsx';
import React, { createRef, useRef } from 'react';

// Every option documented in fern-docs `options.mdx`, asserted against the published `Config` type.
// These run against `dist/index.d.ts`, so this is what catches a public option
// that is dropped, renamed or narrowed in a way the app-level `tsc` projects would not see.
// Kept in sync with specs/public-api/public-surface.json — the parity specs assert the same list at runtime.
type DocumentedOption =
  | 'accept'
  | 'baseUrl'
  | 'cameraCapture'
  | 'cameraMirror'
  | 'cameraModes'
  | 'cdnCname'
  | 'checkForUrlDuplicates'
  | 'cloudImageEditorAutoOpen'
  | 'cloudImageEditorMaskHref'
  | 'cloudImageEditorTabs'
  | 'collectionValidators'
  | 'confirmUpload'
  | 'cropPreset'
  | 'debug'
  | 'defaultCameraMode'
  | 'dynamicButtonShowFirstIcon'
  | 'dynamicButtonViewMode'
  | 'enableAudioRecording'
  | 'enableVideoRecording'
  | 'externalSourcesPreferredTypes'
  | 'fileValidators'
  | 'filesViewMode'
  | 'gridShowFileNames'
  | 'groupOutput'
  | 'iconHrefResolver'
  | 'imageShrink'
  | 'imgOnly'
  | 'localeDefinitionOverride'
  | 'localeName'
  | 'maxConcurrentRequests'
  | 'maxLocalFileSizeBytes'
  | 'maxVideoRecordingDuration'
  | 'metadata'
  | 'multipartChunkSize'
  | 'multipartMaxAttempts'
  | 'multipartMaxConcurrentRequests'
  | 'multipartMinFileSize'
  | 'multiple'
  | 'multipleMax'
  | 'multipleMin'
  | 'pasteScope'
  | 'plugins'
  | 'pubkey'
  | 'qualityInsights'
  | 'remoteTabSessionKey'
  | 'removeCopyright'
  | 'retryNetworkErrorMaxTimes'
  | 'retryThrottledRequestMaxTimes'
  | 'saveUrlForRecurrentUploads'
  | 'secureDeliveryProxy'
  | 'secureDeliveryProxyUrlResolver'
  | 'secureExpire'
  | 'secureSignature'
  | 'secureUploadsExpireThreshold'
  | 'secureUploadsSignatureResolver'
  | 'showEmptyList'
  | 'socialBaseUrl'
  | 'sourceList'
  | 'store'
  | 'tags'
  | 'thumbSize'
  | 'topLevelOrigin'
  | 'useCloudImageEditor'
  | 'validationConcurrency'
  | 'validationTimeout';

test('<uc-config> rejects unknown attributes', () => {
  // @ts-expect-error untyped props
  () => <uc-config ctx-name="1" something="wrong"></uc-config>;
});

test('<uc-config> requires ctx-name', () => {
  // @ts-expect-error missing ctx-name
  () => <uc-config></uc-config>;
});

test('<uc-config> takes the common HTML attributes', () => {
  () => <uc-config ctx-name="1" id="1" class="1" hidden></uc-config>;
});

test('<uc-config> takes a React key', () => {
  () => <uc-config ctx-name="1" key={1}></uc-config>;
});

test('<uc-config> ref through useRef is typed as Config', () => {
  () => {
    const ref = useRef<Config | null>(null);
    expectTypeOf(ref.current).toEqualTypeOf<Config | null>();
    <uc-config ctx-name="1" ref={ref}></uc-config>;
  };
});

test('<uc-config> callback ref receives a Config', () => {
  () => {
    <uc-config
      ctx-name="1"
      ref={(el) => {
        expectTypeOf(el).toEqualTypeOf<Config | null>();
      }}
    ></uc-config>;
  };
});

test('<uc-config> ref through createRef is typed as Config', () => {
  () => {
    const ref = createRef<Config>();
    expectTypeOf(ref.current).toEqualTypeOf<Config | null>();
    <uc-config ctx-name="1" ref={ref}></uc-config>;
  };
});

test('<uc-config> takes the config options as attributes', () => {
  () => <uc-config ctx-name="1" multiple multipleMax={1} multipleMin={2} accept="str" />;
});

test('Config options are settable as DOM properties', () => {
  () => {
    const ref = useRef<Config | null>(null);
    if (ref.current) {
      const config = ref.current;
      config.metadata = { foo: 'bar' };
      config.secureSignature = '1231';
      config.multiple = true;
    }
  };
});

test('metadata takes an object, a function or an async function of the entry', () => {
  () => {
    const ref = useRef<Config | null>(null);
    if (ref.current) {
      const config = ref.current;
      config.metadata = { foo: 'bar' };
      config.metadata = () => ({ foo: 'bar' });
      config.metadata = async (entry) => {
        expectTypeOf(entry).toEqualTypeOf<OutputFileEntry>();
        return { foo: 'bar' };
      };
    }
  };
});

test('tags takes an array or a function', () => {
  () => {
    const ref = useRef<Config | null>(null);
    if (ref.current) {
      const config = ref.current;
      config.tags = ['cat'];
      config.tags = () => ['cat'];
    }
  };
});

test('authToken takes a token or a resolver as a DOM property', () => {
  () => {
    const ref = useRef<Config | null>(null);
    if (ref.current) {
      const config = ref.current;
      config.authToken = 'eyJ.token.sig';
      config.authToken = () => 'eyJ.token.sig';
      config.authToken = async () => 'eyJ.token.sig';
    }
  };
});

test('the auth-token attribute carries only the plain token', () => {
  // An attribute is a string, so the resolver half of the value type is not
  // part of it. (TypeScript does not check hyphenated JSX attributes at all, so
  // this is asserted on the type rather than through <uc-config>.)
  expectTypeOf<ConfigAttributesType['auth-token']>().toEqualTypeOf<string | null>();
  expectTypeOf<ConfigAttributesType['authtoken']>().toEqualTypeOf<string | null>();
});

test('validators take sync, async and descriptor forms', () => {
  () => {
    const ref = useRef<Config | null>(null);
    if (ref.current) {
      const config = ref.current;

      const syncFileValidator: FuncFileValidator = (outputEntry, api) => ({
        message: api.l10n('images-only-accepted'),
        payload: { entry: outputEntry },
      });

      const asyncFileValidator: FuncFileValidator = async (outputEntry, api) => ({
        message: api.l10n('images-only-accepted'),
        payload: { entry: outputEntry },
      });

      const fileValidatorDescriptor: FileValidatorDescriptor = {
        runOn: 'change',
        validator: syncFileValidator,
      };

      const maxCollection: FuncCollectionValidator = (_collection, api) => ({
        message: api.l10n('some-files-were-not-uploaded'),
      });

      config.fileValidators = [syncFileValidator, asyncFileValidator, fileValidatorDescriptor];
      config.collectionValidators = [maxCollection];
    }
  };
});

test('Config has every documented option', () => {
  const documented: Record<DocumentedOption, unknown> = {} as Pick<Config, DocumentedOption>;
  expectTypeOf(documented).toEqualTypeOf<Record<DocumentedOption, unknown>>();
});

test('every documented option has its documented value type', () => {
  const config = {} as Config;

  // boolean
  config.multiple = true;
  config.confirmUpload = true;
  config.imgOnly = true;
  config.cameraMirror = true;
  config.showEmptyList = true;
  config.useCloudImageEditor = true;
  config.groupOutput = true;
  config.checkForUrlDuplicates = true;
  config.saveUrlForRecurrentUploads = true;
  config.removeCopyright = true;
  config.debug = true;
  config.enableAudioRecording = true;
  config.enableVideoRecording = true;
  config.gridShowFileNames = true;
  config.cloudImageEditorAutoOpen = true;
  config.qualityInsights = true;
  config.dynamicButtonShowFirstIcon = true;

  // number
  config.multipleMin = 1;
  config.multipleMax = 1;
  config.maxLocalFileSizeBytes = 1;
  config.thumbSize = 1;
  config.secureUploadsExpireThreshold = 1;
  config.retryThrottledRequestMaxTimes = 1;
  config.retryNetworkErrorMaxTimes = 1;
  config.multipartMinFileSize = 1;
  config.multipartChunkSize = 1;
  config.maxConcurrentRequests = 1;
  config.multipartMaxConcurrentRequests = 1;
  config.multipartMaxAttempts = 1;
  config.validationTimeout = 1;
  config.validationConcurrency = 1;
  config.maxVideoRecordingDuration = 1;

  // string (including the comma-separated ones, which are plain strings on the wire)
  config.pubkey = '';
  config.imageShrink = '';
  config.accept = '';
  config.topLevelOrigin = '';
  config.remoteTabSessionKey = '';
  config.cdnCname = '';
  config.baseUrl = '';
  config.socialBaseUrl = '';
  config.secureSignature = '';
  config.secureExpire = '';
  config.secureDeliveryProxy = '';
  config.localeName = '';
  config.cloudImageEditorMaskHref = '';
  config.externalSourcesPreferredTypes = '';
  config.sourceList = '';
  config.cloudImageEditorTabs = '';
  config.cropPreset = '';
  config.cameraModes = '';

  // unions and structured values
  config.store = 'auto';
  config.store = true;
  config.cameraCapture = 'user';
  config.cameraCapture = 'environment';
  config.cameraCapture = '';
  config.filesViewMode = 'list';
  config.filesViewMode = 'grid';
  config.pasteScope = 'local';
  config.pasteScope = 'global';
  config.pasteScope = false;
  config.dynamicButtonViewMode = 'auto';
  config.dynamicButtonViewMode = 'menu';
  config.dynamicButtonViewMode = 'toolbar';
  config.dynamicButtonViewMode = 'compact';
  config.defaultCameraMode = 'photo';
  config.defaultCameraMode = null;
  config.localeDefinitionOverride = { en: { 'start-from-cancel': 'Never mind' } };
  config.secureUploadsSignatureResolver = async () => ({ secureSignature: 's', secureExpire: 'e' });
  config.secureUploadsSignatureResolver = async () => null;
  config.secureDeliveryProxyUrlResolver = async (_previewUrl, { uuid }) => `https://proxy.example.com/${uuid}`;
  config.iconHrefResolver = (name) => `#uc-icon-${name}`;
  config.plugins = [{ id: 'p', setup: () => {} }];

  // QUIRK(types): options.mdx says returning nothing from `iconHrefResolver` falls back to the default sprite, and
  // `Icon._updateResolvedHref` implements that (`customHref ?? defaultHref`) — but the published type is
  // `(iconName: string) => string`, so the documented resolver does not compile. When the type is widened to
  // `string | undefined` this `@ts-expect-error` starts failing, which is the signal to delete it.
  // @ts-expect-error the documented "return nothing" form is not expressible in the published type
  config.iconHrefResolver = () => undefined;
});
