import { expectType } from 'tsd';
import type {
  Config,
  FileValidatorDescriptor,
  FuncCollectionValidator,
  FuncFileValidator,
  OutputFileEntry,
} from '../../dist/index';
import '../jsx';
import React, { createRef, useRef } from 'react';

// @ts-expect-error untyped props
() => <uc-config ctx-name="1" something="wrong"></uc-config>;

// @ts-expect-error missing ctx-name
() => <uc-config></uc-config>;

// allow common html attributes and required ctx-name
() => <uc-config ctx-name="1" id="1" class="1" hidden></uc-config>;

// allow key prop
() => <uc-config ctx-name="1" key={1}></uc-config>;

// allow useRef hook
() => {
  const ref = useRef<Config | null>(null);
  expectType<Config | null>(ref.current);
  <uc-config ctx-name="1" ref={ref}></uc-config>;
};

// allow callback ref
() => {
  <uc-config
    ctx-name="1"
    ref={(el) => {
      expectType<Config | null>(el);
    }}
  ></uc-config>;
};

// allow createRef
() => {
  const ref = createRef<Config>();
  expectType<Config | null>(ref.current);
  <uc-config ctx-name="1" ref={ref}></uc-config>;
};

// accept config attributes
() => <uc-config ctx-name="1" multiple multipleMax={1} multipleMin={2} accept="str" />;

// allow to use DOM properties
() => {
  const ref = useRef<Config | null>(null);
  if (ref.current) {
    const config = ref.current;
    config.metadata = { foo: 'bar' };
    config.secureSignature = '1231';
    config.multiple = true;
  }
};

// allow to pass metadata
() => {
  const ref = useRef<Config | null>(null);
  if (ref.current) {
    const config = ref.current;
    config.metadata = { foo: 'bar' };
    config.metadata = () => ({ foo: 'bar' });
    config.metadata = async (entry) => {
      expectType<OutputFileEntry>(entry);
      return { foo: 'bar' };
    };
  }
};

// allow to pass tags
() => {
  const ref = useRef<Config | null>(null);
  if (ref.current) {
    const config = ref.current;
    config.tags = ['cat'];
    config.tags = () => ['cat'];
  }
};

// allow to pass validators
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

// Every option documented in fern-docs `options.mdx`, asserted against the published `Config` type.
// tsd checks `dist/index.d.ts` under its own compiler options, so this is what catches a public option
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

// Fails to compile if the published Config loses a documented option.
export const assertDocumentedOptionsExist = () => {
  const documented: Record<DocumentedOption, unknown> = {} as Pick<Config, DocumentedOption>;
  expectType<Record<DocumentedOption, unknown>>(documented);
};

// Documented value types.
export const assertDocumentedOptionTypes = () => {
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

  // QUIRK(types): options.mdx says returning nothing from `iconHrefResolver` falls back to the default sprite, and
  // `Icon._updateResolvedHref` implements that (`customHref ?? defaultHref`) — but the published type is
  // `(iconName: string) => string`, so the documented resolver does not compile. When the type is widened to
  // `string | undefined` this `@ts-expect-error` starts failing, which is the signal to delete it.
  // @ts-expect-error the documented "return nothing" form is not expressible in the published type
  config.iconHrefResolver = () => undefined;
};
