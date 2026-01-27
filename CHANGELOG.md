# [1.26.0](https://github.com/uploadcare/file-uploader/compare/v1.25.0...v1.26.0) (2026-01-27)

## Highlights

* [SymbioteJS](https://symbiotejs.org/) was replaced with [Lit Element](https://lit.dev/).
* All documented public API remains the same.

## Potential Breaking Changes (Minor Release)

Some internal / undocumented APIs may break.

In particular, the undocumented static `template` setter that could be used for template overrides is deprecated and has no effect.

See [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-1.26.0/) for details.

### Bug Fixes

* Fixed thumbnail flicker
* Fixed progress bar flicker

# [1.25.0](https://github.com/uploadcare/file-uploader/compare/v1.24.8...v1.25.0) (2026-01-15)


### Features

* **uc-form-input:** allow to override `name` attribute on native inputs ([#913](https://github.com/uploadcare/file-uploader/issues/913)) ([ca4c7fc](https://github.com/uploadcare/file-uploader/commit/ca4c7fc99de4522d47ea97518b60b069671f4347))



## [1.24.8](https://github.com/uploadcare/file-uploader/compare/v1.24.7...v1.24.8) (2026-01-13)


### Bug Fixes

* **thumb:** alt added to thumb ([#909](https://github.com/uploadcare/file-uploader/issues/909)) ([4aa57bf](https://github.com/uploadcare/file-uploader/commit/4aa57bf7f41885f106580dca96a804e3cac371bf))
* **upload-list:** adjusted upload button visibility ([#911](https://github.com/uploadcare/file-uploader/issues/911)) ([ca6e213](https://github.com/uploadcare/file-uploader/commit/ca6e213eac05e41d406ae62573cfca7a799798b9))



## [1.24.7](https://github.com/uploadcare/file-uploader/compare/v1.24.6...v1.24.7) (2025-12-25)


### Bug Fixes

* **uploader-public-api:** adjusted activityParams ([#906](https://github.com/uploadcare/file-uploader/issues/906)) ([7e808bd](https://github.com/uploadcare/file-uploader/commit/7e808bd071e31577056ea8843ecfd8274ac83b1f))



## [1.24.6](https://github.com/uploadcare/file-uploader/compare/v1.24.5...v1.24.6) (2025-12-23)


### Bug Fixes

* **activity-header:** align header with icon by center ([#904](https://github.com/uploadcare/file-uploader/issues/904)) ([c74675a](https://github.com/uploadcare/file-uploader/commit/c74675a03ef4fa67f8c1388ab7f901ad373be7b7))
* prevent progress bar from resetting to 0 during validation ([#900](https://github.com/uploadcare/file-uploader/issues/900)) ([c52ec43](https://github.com/uploadcare/file-uploader/commit/c52ec435214b81bf18be80f391bc7eb60e773cc8))
* reduced the number of retries ([#902](https://github.com/uploadcare/file-uploader/issues/902)) ([bdece2a](https://github.com/uploadcare/file-uploader/commit/bdece2a9f5eec8511c57563dba980a16aa754fd8))



## [1.24.5](https://github.com/uploadcare/file-uploader/compare/v1.24.4...v1.24.5) (2025-12-01)


### Bug Fixes

* **l10n:** fix "drop-files-here" translation ([#891](https://github.com/uploadcare/file-uploader/issues/891)) ([cc990a2](https://github.com/uploadcare/file-uploader/commit/cc990a287320a3c9f4de38a462cb9bba3b9c4e41))
* use unlayered css by default & add separate layered bundle ([#893](https://github.com/uploadcare/file-uploader/issues/893)) ([d039026](https://github.com/uploadcare/file-uploader/commit/d039026f1eaf7d87ccc26cd2e169df3611cd48b3))



## [1.24.4](https://github.com/uploadcare/file-uploader/compare/v1.24.3...v1.24.4) (2025-11-21)


### Bug Fixes

* **deps:** bump @uploadcare/quality-insights package to fix unneeded dependencies leak ([#889](https://github.com/uploadcare/file-uploader/issues/889)) ([cbba698](https://github.com/uploadcare/file-uploader/commit/cbba69881e8c09f421f452b5701448ea73faf5d6))



## [1.24.3](https://github.com/uploadcare/file-uploader/compare/v1.24.2...v1.24.3) (2025-11-06)


### Bug Fixes

* generate unique svg id for the backdrop mask ([#884](https://github.com/uploadcare/file-uploader/issues/884)) ([3b092ff](https://github.com/uploadcare/file-uploader/commit/3b092ff75df10020a65b928d75f4c7fa5c856aba))



## [1.24.2](https://github.com/uploadcare/file-uploader/compare/v1.24.1...v1.24.2) (2025-11-05)


### Bug Fixes

* **config:** moved abortControllers to block scope to prevent cross-cancellation ([#880](https://github.com/uploadcare/file-uploader/issues/880)) ([37cb841](https://github.com/uploadcare/file-uploader/commit/37cb8416929958b616b0643135eccaab83d4d9ad))
* **quality-insights:** added improved event display ([#879](https://github.com/uploadcare/file-uploader/issues/879)) ([a0d7b2d](https://github.com/uploadcare/file-uploader/commit/a0d7b2db8773b8a80819a92e3ed60df82e8cfb12))



## [1.24.1](https://github.com/uploadcare/file-uploader/compare/v1.24.0...v1.24.1) (2025-10-30)

### Bug Fixes

- **file-item:** hide "waiting for social source" hint after successful upload ([#876](https://github.com/uploadcare/file-uploader/issues/876))
- **social-source:** use specified `targetOrigin` for `postMessage` calls ([#876](https://github.com/uploadcare/file-uploader/issues/876))
- **social-source:** toggle "Done" button visibility together with selection status block ([#876](https://github.com/uploadcare/file-uploader/issues/876))
- **config:** run initial configuration side effects after all config keys have been processed ([#875](https://github.com/uploadcare/file-uploader/issues/875))

# [1.24.0](https://github.com/uploadcare/file-uploader/compare/v1.23.1...v1.24.0) (2025-10-28)

## Highlights
* Fully rewritten to TypeScript
* Added support for CSS Layers (more predictable style overrides)

## Potential Breaking Changes (Minor Release)

Some type definitions and imports were cleaned up:

### Type updates
```diff
- type MyCfg = InstanceOf<Config>
+ type MyCfg = Config
```

```diff
- type MyProvider = InstanceOf<UploadCtxProvider>
+ type MyProvider = UploadCtxProvider
```

### CSS import change

```diff
- import '@uploadcare/file-uploader/blocks/themes/uc-basic/index.css'
+ import '@uploadcare/file-uploader/index.css'
```

We've preserved the NPM package exports API, so most setups should work without changes.

## Migration Checklist

* Replace `InstanceOf<>` usage
* Update CSS import path
* If you override styles, verify nothing shifts with CSS layers

## Need help?

If you hit unexpected issues, please open an issue - we'll take a look!


## [1.23.1](https://github.com/uploadcare/file-uploader/compare/v1.23.0...v1.23.1) (2025-10-24)

### Bug Fixes

- **external sources:** hide spinner button until external source authentication done ([#869](https://github.com/uploadcare/file-uploader/issues/869)) ([ed0aa7a](https://github.com/uploadcare/file-uploader/commit/ed0aa7a3d18031e806fb22c8b45c6c2ac7a38080))

# [1.23.0](https://github.com/uploadcare/file-uploader/compare/v1.22.0...v1.23.0) (2025-10-07)

### Bug Fixes

- **cloud-image-editor:** ResizeObserver loop completed with undelivered notifications error ([aca1331](https://github.com/uploadcare/file-uploader/commit/aca13310efa38d110e66957420bf058952cc0b3f))
- **locales:** correct capitalization from "Onedrive" to "OneDrive" ([#863](https://github.com/uploadcare/file-uploader/issues/863)) ([5b22196](https://github.com/uploadcare/file-uploader/commit/5b221969df47b36bc77dbdebce692c0ebafb46ec))

### Features

- **validation:** add support for async file validation ([a184ff1](https://github.com/uploadcare/file-uploader/commit/a184ff167a7072ccbed76e3e9e108e4e980a8f56)). See [File Validation docs](https://uploadcare.com/docs/file-uploader/file-validators/) for details.

# [1.22.0](https://github.com/uploadcare/file-uploader/compare/v1.21.0...v1.22.0) (2025-09-25)

### Features

- **cloud-editor:** added improved UX for crop presets ([#861](https://github.com/uploadcare/file-uploader/issues/861)) ([b35ef61](https://github.com/uploadcare/file-uploader/commit/b35ef61f38d9af76b5d6a01fb29da5fedc72a6b7))

# [1.21.0](https://github.com/uploadcare/file-uploader/compare/v1.20.1...v1.21.0) (2025-09-10)

### Features

- **quality-insights:** implemented manager for quality-insights ([c8e1941](https://github.com/uploadcare/file-uploader/commit/c8e1941c018b0529f76b5401019a8281f7e7980f)). See the [documentation](https://uploadcare.com/docs/file-uploader/options/#quality-insights) for details.

## [1.20.1](https://github.com/uploadcare/file-uploader/compare/v1.20.0...v1.20.1) (2025-08-27)

### Bug Fixes

- prevent event duplication when uploader is remounted multiple times ([#849](https://github.com/uploadcare/file-uploader/issues/849)) ([dde4566](https://github.com/uploadcare/file-uploader/commit/dde4566f88f51aacd80d8a559ebcfe0f2f71bfc8))

# [1.20.0](https://github.com/uploadcare/file-uploader/compare/v1.19.5...v1.20.0) (2025-08-25)

### Features

- **cloud-editor:** added multiple crop presets ([#845](https://github.com/uploadcare/file-uploader/issues/845)) ([720c2e3](https://github.com/uploadcare/file-uploader/commit/720c2e3004d2e574b5eff3c59fb0039584f704b8)). See the [documentation](https://uploadcare.com/docs/file-uploader/options/#crop-preset) for details.

## [1.19.5](https://github.com/uploadcare/file-uploader/compare/v1.19.4...v1.19.5) (2025-08-21)

### Bug Fixes

- **api:** allow to use both configured cdnBase and ucarecdn.com as host when calling `addFileFromCdnUrl` ([#844](https://github.com/uploadcare/file-uploader/issues/844)) ([7cac4c3](https://github.com/uploadcare/file-uploader/commit/7cac4c3b7cd2b1e8339c7fe69f7e460de7064fb2))

## [1.19.4](https://github.com/uploadcare/file-uploader/compare/v1.19.3...v1.19.4) (2025-07-30)

### Bug Fixes

- resolve TypeScript compilation error in Angular app ([#841](https://github.com/uploadcare/file-uploader/issues/841)) ([1c09279](https://github.com/uploadcare/file-uploader/commit/1c0927994b0af7e7f896ed62ea1de348004e27e7))

## [1.19.3](https://github.com/uploadcare/file-uploader/compare/v1.19.2...v1.19.3) (2025-07-15)

### Bug Fixes

- check promises with duck-typing ([#838](https://github.com/uploadcare/file-uploader/issues/838)) ([6ba891e](https://github.com/uploadcare/file-uploader/commit/6ba891e89b83eb4640c46557cb83e30ff17cdbff))

## [1.19.2](https://github.com/uploadcare/file-uploader/compare/v1.19.1...v1.19.2) (2025-07-10)

### Bug Fixes

- **config:** update prefixed cname on every pubkey change & skip empty pubkeys ([9e5c4b0](https://github.com/uploadcare/file-uploader/commit/9e5c4b0d6df16ddc2be30e22928030e1bf9cc79e))
- **file-item:** show `waiting for` hints for social sources only ([34ae28a](https://github.com/uploadcare/file-uploader/commit/34ae28a3bd4bef93a9fff86c9775df1f3be6a892))

## [1.19.1](https://github.com/uploadcare/file-uploader/compare/v1.19.0...v1.19.1) (2025-07-08)

### Bug Fixes

- subdomain prefix wrong calculation ([#834](https://github.com/uploadcare/file-uploader/issues/834)) ([964da65](https://github.com/uploadcare/file-uploader/commit/964da6541163367f59083a819be3b38a9b50bff3))

# [1.19.0](https://github.com/uploadcare/file-uploader/compare/v1.18.0...v1.19.0) (2025-07-07)

### Features

- **a11y:** added outline-offeset and label for input ([#832](https://github.com/uploadcare/file-uploader/issues/832)) ([463a7cc](https://github.com/uploadcare/file-uploader/commit/463a7cc8769305dd8b5b452c72b9db7b91c5df06))
- add support for prefixed cdn subdomains ([#826](https://github.com/uploadcare/file-uploader/issues/826)) ([63a687f](https://github.com/uploadcare/file-uploader/commit/63a687f7426ff5d78818fe1c163d2925f5bf254f))

# [1.18.0](https://github.com/uploadcare/file-uploader/compare/v1.17.2...v1.18.0) (2025-06-23)

### Features

- add `retryNetworkErrorMaxTimes` option ([#827](https://github.com/uploadcare/file-uploader/issues/827)) ([20dfdea](https://github.com/uploadcare/file-uploader/commit/20dfdea1200fd3f50c2f7dc4df9d56596039c6d2))

## [1.17.2](https://github.com/uploadcare/file-uploader/compare/v1.17.1...v1.17.2) (2025-06-18)

### Bug Fixes

- set position absolute on hidden file input to prevent host page layout issues ([#823](https://github.com/uploadcare/file-uploader/issues/823)) ([fd7fb11](https://github.com/uploadcare/file-uploader/commit/fd7fb117445709c73b81f62171814a18a2182789))

## [1.17.1](https://github.com/uploadcare/file-uploader/compare/v1.17.0...v1.17.1) (2025-06-18)

### Bug Fixes

- missing css custom properties config on uc-upload-ctx-provider ([#819](https://github.com/uploadcare/file-uploader/issues/819)) ([911d9c6](https://github.com/uploadcare/file-uploader/commit/911d9c6b4cb5eacbbcb50b7c522895ff765c8161))

# [1.17.0](https://github.com/uploadcare/file-uploader/compare/v1.16.2...v1.17.0) (2025-06-16)

### Features

- **external-sources:** use Google Drive Picker for Google Drive social source ([#818](https://github.com/uploadcare/file-uploader/issues/818)) ([5ac0479](https://github.com/uploadcare/file-uploader/commit/5ac0479f93a91b58b8d72bfb763bc74bb00eb2d2))

## [1.16.2](https://github.com/uploadcare/file-uploader/compare/v1.16.1...v1.16.2) (2025-05-07)

### Bug Fixes

- **modal:** added hasActiveModals in emit for close modal ([#813](https://github.com/uploadcare/file-uploader/issues/813)) ([808b74e](https://github.com/uploadcare/file-uploader/commit/808b74e92b3db0e5cece5bb0c46eb130178d430a))

## [1.16.1](https://github.com/uploadcare/file-uploader/compare/v1.16.0...v1.16.1) (2025-05-05)

### Bug Fixes

- **events:** added emit events for open/close modal ([#811](https://github.com/uploadcare/file-uploader/issues/811)) ([d1ef03a](https://github.com/uploadcare/file-uploader/commit/d1ef03a32af1645a18f90e8e0a871fe5218cd031))

# [1.16.0](https://github.com/uploadcare/file-uploader/compare/v1.15.0...v1.16.0) (2025-04-28)

### Features

- **cloud-editor:** added image mask ([#779](https://github.com/uploadcare/file-uploader/issues/779)) ([1863a5d](https://github.com/uploadcare/file-uploader/commit/1863a5d729956cc93ac5e66a1d13c8a41815124b)). See the [documentation](https://uploadcare.com/docs/file-uploader/options/#cloud-image-editor-mask-href) for details.

# [1.15.0](https://github.com/uploadcare/file-uploader/compare/v1.14.0...v1.15.0) (2025-04-22)

### Bug Fixes

- increased the retry count for throttled requests to 10 ([#800](https://github.com/uploadcare/file-uploader/issues/800)) ([1f039b1](https://github.com/uploadcare/file-uploader/commit/1f039b10d11d7eb8511e8ae501c0da3ba0929d49))
- prevented HEIC to JPEG conversion on Desktop Safari ([#805](https://github.com/uploadcare/file-uploader/issues/805)) ([cf3b713](https://github.com/uploadcare/file-uploader/commit/cf3b7133ef5231998bc667703bd22e8ac509797f))
- **types:** made the `headless` attribute optional ([#807](https://github.com/uploadcare/file-uploader/issues/807)) ([579e88d](https://github.com/uploadcare/file-uploader/commit/579e88de2f50153d064a63880ce6a292448b23fe))

### Features

- **file item** added a "Queued" hint ([#803](https://github.com/uploadcare/file-uploader/issues/803)) ([3b08242](https://github.com/uploadcare/file-uploader/commit/3b08242df64f00d672aacb6b337db7094728af4b))
- **upload list** added grid mode in upload list ([#797](https://github.com/uploadcare/file-uploader/pull/797)) ([a302461](https://github.com/uploadcare/file-uploader/commit/a30246114b7c170140787eeec2d0bc9f21495e8f)). See the [documentation](https://uploadcare.com/docs/file-uploader/options/#files-view-mode) for details.
- **minimal mode** added cloudImageEditor and sources in minimal mode ([#797](https://github.com/uploadcare/file-uploader/pull/797)) ([a302461](https://github.com/uploadcare/file-uploader/commit/a30246114b7c170140787eeec2d0bc9f21495e8f))
- **cloud editor** added cloudImageEditorAutoOpen prop ([#797](https://github.com/uploadcare/file-uploader/pull/797)) ([a302461](https://github.com/uploadcare/file-uploader/commit/a30246114b7c170140787eeec2d0bc9f21495e8f)). See the [documentation](https://uploadcare.com/docs/file-uploader/options/#cloud-image-editor-auto-open) for details.

# [1.14.0](https://github.com/uploadcare/file-uploader/compare/v1.13.2...v1.14.0) (2025-03-12)

### Features

- **camera** added a check for mobile devices when capturing media. Now, instead of using a single camera source, separate cameras are rendered for photo and video capture. ([#795](https://github.com/uploadcare/file-uploader/issues/795)) ([0e7383c](https://github.com/uploadcare/file-uploader/commit/0e7383cc222a99c6bc3eec778ffca6228383926a))

## [1.13.2](https://github.com/uploadcare/file-uploader/compare/v1.13.1...v1.13.2) (2025-02-13)

### Bug Fixes

- **a11y** added `role` and `aria-label` for screen readers ([#788](https://github.com/uploadcare/file-uploader/issues/788)) ([5a5c28a](https://github.com/uploadcare/file-uploader/commit/5a5c28a33fd1fc2e5f08b8d84cc725fcc7ff162b))
- **cloud-editor** close ui slider when click on the editor toolbar ([#790](https://github.com/uploadcare/file-uploader/issues/790)) ([6d59f25](https://github.com/uploadcare/file-uploader/commit/6d59f254b94b5389d1c990e7641b80972646665c))

## [1.13.1](https://github.com/uploadcare/file-uploader/compare/v1.13.0...v1.13.1) (2025-02-03)

### Bug Fixes

- **file-item:** improve progressbar ui when uploading from external URLs ([#784](https://github.com/uploadcare/file-uploader/issues/784)) ([86dfbb1](https://github.com/uploadcare/file-uploader/commit/86dfbb13daed4d244658b1097160eeecfa2eae08))

# [1.13.0](https://github.com/uploadcare/file-uploader/compare/v1.12.1...v1.13.0) (2025-01-30)

### Features

- add `cameraModes` option, deprecate `enableVideoRecording` and `defaultCameraMode` options ([#781](https://github.com/uploadcare/file-uploader/issues/781)) ([7fbe522](https://github.com/uploadcare/file-uploader/commit/7fbe5227081da7a4515a93b61e122ea1d7e850f9))

## [1.12.1](https://github.com/uploadcare/file-uploader/compare/v1.12.0...v1.12.1) (2025-01-28)

### Bug Fixes

- **drop-area:** added position:relative for upload-list ([#782](https://github.com/uploadcare/file-uploader/issues/782)) ([8c7fa63](https://github.com/uploadcare/file-uploader/commit/8c7fa6345c4cdcc992c96e61155fc822ad551cb7))

# [1.12.0](https://github.com/uploadcare/file-uploader/compare/v1.11.3...v1.12.0) (2025-01-08)

### Bug Fixes

- **external-sources:** done button loading state behaviour ([#770](https://github.com/uploadcare/file-uploader/issues/770)) ([77b545e](https://github.com/uploadcare/file-uploader/commit/77b545e445f2acd358e0ce849b211ce8c451d02e))

### Features

- **external-sources:** add `externalSourcesEmbedCss` config option to set embed css on external sources iframe ([#769](https://github.com/uploadcare/file-uploader/issues/769)) ([8cbbdb3](https://github.com/uploadcare/file-uploader/commit/8cbbdb3db3e111f49927bd2afe9df34a9d12cac8))
- **social-source:** deprecate instagram source ([#767](https://github.com/uploadcare/file-uploader/issues/767)) ([ed239a0](https://github.com/uploadcare/file-uploader/commit/ed239a00cfc9bc63d1ecb470e57dd2103e0f6b6a))

## [1.11.3](https://github.com/uploadcare/file-uploader/compare/v1.11.2...v1.11.3) (2024-12-12)

### Bug Fixes

- **camera-tab:** added check removeEventListener ([#765](https://github.com/uploadcare/file-uploader/issues/765)) ([31cb01a](https://github.com/uploadcare/file-uploader/commit/31cb01a6ba9f5c56601f0858ab13e4cfeefe64a3))

## [1.11.2](https://github.com/uploadcare/file-uploader/compare/v1.11.1...v1.11.2) (2024-12-12)

### Bug Fixes

- **camera-tab:** added mimeType fallback for safari ([#763](https://github.com/uploadcare/file-uploader/issues/763)) ([bd45833](https://github.com/uploadcare/file-uploader/commit/bd45833805c4e0b71067dca41ae013d0534dc07e))

# [1.11.0](https://github.com/uploadcare/file-uploader/compare/v1.10.0...v1.11.1) (2024-12-04)

### Features

- **camera-tab:** video recording ([#755](https://github.com/uploadcare/file-uploader/issues/755)) ([8173852](https://github.com/uploadcare/file-uploader/commit/81738528adc76d19cb3ad24030dec96dcba9dc1d))
- **social-sourcesЖ** redesign & batch file selection ([#750](https://github.com/uploadcare/file-uploader/issues/750)) ([db836e0](https://github.com/uploadcare/file-uploader/commit/db836e0060ac29af67987288f1d488d1df711111))

# [1.10.0](https://github.com/uploadcare/file-uploader/compare/v1.9.0...v1.10.0) (2024-11-02)

### Features

- **locale** added support for Finnish locale, enabling full application functionality in Finnish. ([#753](https://github.com/uploadcare/file-uploader/issues/753)) ([d6aecca](https://github.com/uploadcare/file-uploader/commit/d6aecca66ebb68ddaf2d1a69d0bf8c97d7de6e28))

# [1.9.0](https://github.com/uploadcare/file-uploader/compare/v1.8.1...v1.9.0) (2024-10-04)

### Features

- **a11y:** added accessible titles to buttons in `uc-activity-header` ([#748](https://github.com/uploadcare/file-uploader/issues/748)) ([97f13e3](https://github.com/uploadcare/file-uploader/commit/97f13e32442bbc33080365f6febf7e0d031cd68e))

## [1.8.1](https://github.com/uploadcare/file-uploader/compare/v1.8.0...v1.8.1) (2024-10-02)

### Bug Fixes

- **svg-sprite:** unneeded icons leak to the uc-basic sprite ([#746](https://github.com/uploadcare/file-uploader/issues/746)) ([f4decff](https://github.com/uploadcare/file-uploader/commit/f4decff895e174b70f9f394d7d67c59f14d9cf76))

# [1.8.0](https://github.com/uploadcare/file-uploader/compare/v1.7.0...v1.8.0) (2024-09-24)

### Features

- **cloud-editor** increased the capture area for dragging ([#741](https://github.com/uploadcare/file-uploader/issues/741)) ([47cc087](https://github.com/uploadcare/file-uploader/commit/47cc0871fc503a8a74ec598651053a92a2f54e49))

# [1.7.0](https://github.com/uploadcare/file-uploader/compare/v1.6.0...v1.7.0) (2024-09-19)

### Features

- **a11y:** added WCAG AAA contrast and high-contrast theme ([#739](https://github.com/uploadcare/file-uploader/issues/739)) ([82c29e1](https://github.com/uploadcare/file-uploader/commit/82c29e17cd84fb23f71a3e43e259ba5edd82173d))

# [1.6.0](https://github.com/uploadcare/file-uploader/compare/v1.5.2...v1.6.0) (2024-09-02)

### Features

- **a11y:** add `aria-live` attribute to the file item elements to make the uploading status observable by the screen readers ([#733](https://github.com/uploadcare/file-uploader/issues/733)) ([649db3b](https://github.com/uploadcare/file-uploader/commit/649db3bcdbc81e5fc2dfea1fcb34b4051bbd7e3b))
- **output-file-entry:** add `source` property to the `OutputFileEntry` object. This property indicated from which upload source the file was added: local, camera, dropbox etc. ([#736](https://github.com/uploadcare/file-uploader/issues/736)) ([6fe5bcd](https://github.com/uploadcare/file-uploader/commit/6fe5bcd8c95894c26b0e747db5817a2247347dfe))

## [1.5.2](https://github.com/uploadcare/file-uploader/compare/v1.5.1...v1.5.2) (2024-08-26)

### Bug Fixes

- system file dialog on safari ([#730](https://github.com/uploadcare/file-uploader/issues/730)) ([cfdd43a](https://github.com/uploadcare/file-uploader/commit/cfdd43a5306b1e492b673665d52fc1dfc6d52d41))

## [1.5.1](https://github.com/uploadcare/file-uploader/compare/v1.5.0...v1.5.1) (2024-08-21)

### Bug Fixes

- **styles:** compatibility issues with tailwindcss/forms ([#728](https://github.com/uploadcare/file-uploader/issues/728)) ([2fb5ca0](https://github.com/uploadcare/file-uploader/commit/2fb5ca0eacaba4b430c08e0b8bcac4946bec2eea))

# [1.5.0](https://github.com/uploadcare/file-uploader/compare/v1.4.0...v1.5.0) (2024-08-15)

### Bug Fixes

- **cloud-image-editor:** little memory leak where cloud image editor was holding some references that prevents from context destroying ([70a9b2b](https://github.com/uploadcare/file-uploader/commit/70a9b2b1e2ee3c7de9b9c4ffe46bb7da7d7c8d7c))

### Features

- **a11y:** Added title to button ([#723](https://github.com/uploadcare/file-uploader/issues/723)) ([3090304](https://github.com/uploadcare/file-uploader/commit/30903047df63f39b5e199c404cc10e6ac6439504))
- **public-upload-api:** add method `getCurrentActivity` ([3f5b127](https://github.com/uploadcare/file-uploader/commit/3f5b1279c49ffc9efd58486e0fb1f160e64389b3))
- **public-upload-api:** allow to switch activity to the cloud image editor with predefined file opened ([ef663fa](https://github.com/uploadcare/file-uploader/commit/ef663fae8ea7af06dfc66eecd1c0f6a19e5b7e3b))

# [1.4.0](https://github.com/uploadcare/file-uploader/compare/v1.3.0...v1.4.0) (2024-08-14)

### Features

- **theme:** add predefined color presets classes ([#715](https://github.com/uploadcare/file-uploader/issues/715)) ([3dc0b46](https://github.com/uploadcare/file-uploader/commit/3dc0b467c3738cc4284b7ca35fb2944eb51b6ad8))

# [1.3.0](https://github.com/uploadcare/file-uploader/compare/v1.2.0...v1.3.0) (2024-08-08)

### Features

- remove common progress bar from the regular and inline modes ([#721](https://github.com/uploadcare/file-uploader/issues/721)) ([f7b8fa7](https://github.com/uploadcare/file-uploader/commit/f7b8fa756d93c99b1541c874a8bc87a9b1b85b5f))

# [1.2.0](https://github.com/uploadcare/blocks/compare/v1.0.0...v1.2.0) (2024-08-01)

### Bug Fixes

- **regular-mode:** disable done button until group created ([#710](https://github.com/uploadcare/blocks/issues/710)) ([3e30f63](https://github.com/uploadcare/blocks/commit/3e30f638804062e80e683097f3dd0813e14eca15))

### Features

- add cloud-image-editor telemetry ([#703](https://github.com/uploadcare/blocks/issues/703)) ([cbd69b8](https://github.com/uploadcare/blocks/commit/cbd69b852e85b73c21cdbaea228f19529c23183c))

### BREAKING CHANGES:

- rename package `@uploadcare/blocks` to `@uploadcare/file-uploader`
- method `connectBlocksFrom` renamed to `loadFileUploaderFrom` ([d083cb7](https://github.com/uploadcare/blocks/commit/d083cb7bac5fd223ef322c851a9629e38eb4541f))
- method `registerBlocks` renamed to `defineComponents` ([606f8fc](https://github.com/uploadcare/blocks/commit/606f8fc1bf8b8f8242515c1da12ab9f3ec396b0b))
- rename all prefixes from `lr` to `uc` (https://github.com/uploadcare/blocks/issues/698) ([e28f2af](https://github.com/uploadcare/blocks/commit/e28f2af9c48704c49fb115769c01c9e82b300f39))

See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-1.x/) for details.

## [0.50.1](https://github.com/uploadcare/blocks/compare/v0.50.0...v0.50.1) (2024-07-16)

### Bug Fixes

- **styles:** added prefix uc- to className in the js ([#700](https://github.com/uploadcare/blocks/issues/700)) ([672c5c3](https://github.com/uploadcare/blocks/commit/672c5c3f15ce7bb54027ae2ba77217c3aa622824))

# [0.50.0](https://github.com/uploadcare/blocks/compare/v0.49.0...v0.50.0) (2024-07-16)

### Features

- async `secureDeliveryProxyUrlResolver` ([#677](https://github.com/uploadcare/blocks/issues/677)) ([60f06be](https://github.com/uploadcare/blocks/commit/60f06be2ac903d3901eded42cc6ccaaaff41a97a))

See the [`secureDeliveryProxyUrlResolver` docs](https://uploadcare.com/docs/file-uploader/options/#secure-delivery-proxy-url-resolver) for details.

# [0.49.0](https://github.com/uploadcare/blocks/compare/v0.48.1...v0.49.0) (2024-07-03)

### BEAKING CHANGES

- **styles:** Added the `uc-` prefix to all class selectors ([#683](https://github.com/uploadcare/blocks/issues/683)) ([a3929d5](https://github.com/uploadcare/blocks/commit/a3929d599e23e221b2fe88b2d2489a35c8ee7899)).

See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.49.0/) for details.

## [0.48.1](https://github.com/uploadcare/blocks/compare/v0.48.0...v0.48.1) (2024-07-02)

### Bug Fixes

- **a11y:** Added a type for the button ([#695](https://github.com/uploadcare/blocks/issues/695)) ([af1d6b6](https://github.com/uploadcare/blocks/commit/af1d6b63112cc383bcad52d099d84460da937ffa))

## [0.48.0](https://github.com/uploadcare/blocks/compare/v0.47.0...v0.48.0) (2024-07-02)

# [0.47.0](https://github.com/uploadcare/blocks/compare/v0.46.3...v0.47.0) (2024-07-02)

### BEAKING CHANGES

- Extract public api to the composition class at the Uploader API instance that you can get using `getAPI()` method of the `lr-upload-ctx-provider` block. ([#676](https://github.com/uploadcare/blocks/issues/676)) ([ea29dd2](https://github.com/uploadcare/blocks/commit/ea29dd2ebfc5b5897c7db8f6dbda608604eea86c)).

See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.47.0/) for details.

## [0.46.3](https://github.com/uploadcare/blocks/compare/v0.46.2...v0.46.3) (2024-07-01)

### Bug Fixes

- **icons:** Added currentColor to icon edit-file ([#689](https://github.com/uploadcare/blocks/issues/689)) ([617d3cd](https://github.com/uploadcare/blocks/commit/617d3cd8e0cde8ecadd6024ce321b7ba507009f1))

## [0.46.2](https://github.com/uploadcare/blocks/compare/v0.46.1...v0.46.2) (2024-07-01)

### Bug Fixes

- **icons:** added icon edit file ([#687](https://github.com/uploadcare/blocks/issues/687)) ([2a869ab](https://github.com/uploadcare/blocks/commit/2a869abfdbe571aff52ccc5687a8c66e0d829cb5))

## [0.46.1](https://github.com/uploadcare/blocks/compare/v0.46.0...v0.46.1) (2024-06-28)

### Bug Fixes

- **events:** Added status after deleting files in idle ([#684](https://github.com/uploadcare/blocks/issues/684)) ([0e07ee3](https://github.com/uploadcare/blocks/commit/0e07ee3d82a326e56cab343dafdf7472f2d73216))

# [0.46.0](https://github.com/uploadcare/blocks/compare/v0.45.0...v0.46.0) (2024-06-24)

### Features

- Significant improvements to accessibility and keyboard navigation, enhancing user experience and inclusivity ([#671](https://github.com/uploadcare/blocks/issues/671)) ([4acb8a0](https://github.com/uploadcare/blocks/commit/4acb8a0b7ea9c7a95be415627f7d4e1eb748fcf2))

# [0.45.0](https://github.com/uploadcare/blocks/compare/v0.44.0...v0.45.0) (2024-06-23)

### BEAKING CHANGES

- The previously deprecated API method `setUploadMetadata` has been removed. Use `metadata` instance property on `lr-config` block instead. See [metadata](https://uploadcare.com/docs/file-uploader/options/#metadata) for more details.
- The previously deprecated API method `addFiles` has been removed. Use `addFileFromObject`, `addFileFromUrl` or `addFileFromUuid` instead. See [File Uploader API](https://uploadcare.com/docs/file-uploader/api/#add-file-from-object) for more details.

See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.45.0/) for details.

# [0.44.0](https://github.com/uploadcare/blocks/compare/v0.43.0...v0.44.0) (2024-06-21)

### BEAKING CHANGES

- All theme variables of the previous version are deprecated and won't affect the look anymore.
- The default button that opens the uploader dialog (SimpleBtn) component now uses independent variables.
- By default, the theme now uses OKLCH color space. You can still override it using other color spaces, but we recommend converting your colors to OKLCH.

See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.44.0/) for details.

Full styling docs are available [here](https://uploadcare.com/docs/file-uploader/styling/).

### Features

- updated theming mechanics with oklch colors and reworked css properties ([#662](https://github.com/uploadcare/blocks/issues/662)) ([ee90e66](https://github.com/uploadcare/blocks/commit/ee90e66c076e21e1ee92b2f4c60f8eb955a7d5bc))

# [0.43.0](https://github.com/uploadcare/blocks/compare/v0.42.1...v0.43.0) (2024-06-14)

### Features

- added `collectionValidators` and `fileValidators`: Custom validators are now supported for collections and files. This enhancement allows for the addition of necessary checks for uploaded files and collections, providing flexibility and control over compliance with requirements ([#667](https://github.com/uploadcare/blocks/issues/667)) ([d3260b0](https://github.com/uploadcare/blocks/commit/d3260b0cce5ac6ca7cfd0aeb8aff0c9fc35036ed)). See docs [here](https://uploadcare.com/docs/file-uploader/validators).

## [0.42.1](https://github.com/uploadcare/blocks/compare/v0.42.0...v0.42.1) (2024-05-30)

# [0.42.0](https://github.com/uploadcare/blocks/compare/v0.41.1...v0.42.0) (2024-05-30)

### Features

- **lr-file-uploader-regular:** added attribute headless ([5e58ff4](https://github.com/uploadcare/blocks/commit/5e58ff4c666ff13a69bc69429090f0d691c3af0c)). See docs [here](https://uploadcare.com/docs/file-uploader/installation/#choose-a-solution).

## [0.41.1](https://github.com/uploadcare/blocks/compare/v0.41.0...v0.41.1) (2024-05-27)

### Bug Fixes

- **styles-readme:** updated connect style in the project ([#663](https://github.com/uploadcare/blocks/issues/663)) ([2ee913f](https://github.com/uploadcare/blocks/commit/2ee913f93ee44ffbd440c66f9ab6b0c92276faa2))

# [0.41.0](https://github.com/uploadcare/blocks/compare/v0.40.0...v0.41.0) (2024-05-24)

### Features

- add `secureDeliveryProxyUrlResolver` option ([c7cfcd0](https://github.com/uploadcare/blocks/commit/c7cfcd00563dc377b0368f1e2adc0ad973bcb20b)). See docs [here](https://uploadcare.com/docs/file-uploader/options/#secure-delivery-proxy-url-resolver).
- add `secureUploadsExpireThreshold` option ([0d9205d](https://github.com/uploadcare/blocks/commit/0d9205d0391f7c703069ac77efd62b0709bde626)). See docs [here](https://uploadcare.com/docs/file-uploader/options/#secure-uploads-expire-threshold).
- add `secureUploadsSignatureResolver` option ([226d36f](https://github.com/uploadcare/blocks/commit/226d36f691803801fcc15aa014aefa9e57959d50)). See docs [here](https://uploadcare.com/docs/file-uploader/options/#secure-uploads-signature-resolver).

# [0.40.0](https://github.com/uploadcare/blocks/compare/v0.39.1...v0.40.0) (2024-05-17)

### BREAKING CHANGES

- Icons are moved from CSS custom properties to SVG sprites. Overriding icons is
  now done via the `iconHrefResolver` option. See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.40.0/) for details.

### Bug Fixes

- **image-editor:** check for imageSize before commit ([cdb87b4](https://github.com/uploadcare/blocks/commit/cdb87b47b5580b25696944c864e451881f99bcb6))
- **image-editor:** define icons size via css ([080439f](https://github.com/uploadcare/blocks/commit/080439f2bad5a602982f94cf5cc0bdfab22d8609))

### Features

- load svg icons as sprite ([9cf4c07](https://github.com/uploadcare/blocks/commit/9cf4c074895b2bfa76f7a2ea8801b85ba1ea48be))

## [0.39.1](https://github.com/uploadcare/blocks/compare/v0.39.0...v0.39.1) (2024-05-15)

### Bug Fixes

- **l10n:** add l10n key to the state if it's not present ([#656](https://github.com/uploadcare/blocks/issues/656)) ([227a88f](https://github.com/uploadcare/blocks/commit/227a88f14571b3945ce6f622b20ee21e4f6f8664))

# [0.39.0](https://github.com/uploadcare/blocks/compare/v0.38.3...v0.39.0) (2024-05-07)

### Features

- **shadow-styles:** eliminating shadow styles ([#646](https://github.com/uploadcare/blocks/issues/646)) ([984dbda](https://github.com/uploadcare/blocks/commit/984dbda990fb4403b1a0629b5ff8440aff843103))

## [0.38.3](https://github.com/uploadcare/blocks/compare/v0.38.2...v0.38.3) (2024-05-07)

### Bug Fixes

- **lr-config:** normalize DOM property values ([#653](https://github.com/uploadcare/blocks/issues/653)) ([5aa55c2](https://github.com/uploadcare/blocks/commit/5aa55c2c5e543857813e330251faa83206d2992a))

## [0.38.2](https://github.com/uploadcare/blocks/compare/v0.38.1...v0.38.2) (2024-04-29)

### Bug Fixes

- **config:** dont bind complex config options to the attributes ([#650](https://github.com/uploadcare/blocks/issues/650)) ([310c728](https://github.com/uploadcare/blocks/commit/310c728e60ee3560fb751e8e75233d67c498f3c4))

## [0.38.1](https://github.com/uploadcare/blocks/compare/v0.38.0...v0.38.1) (2024-04-29)

### Bug Fixes

- **upload-list:** set fixed modal container width to avoid bouncy width (could lead to some l10n ui width glitches but we're ok with them) ([#648](https://github.com/uploadcare/blocks/issues/648)) ([167af55](https://github.com/uploadcare/blocks/commit/167af555d6bf44f59e1c63323d7f9dc55ba43b47))

# [0.38.0](https://github.com/uploadcare/blocks/compare/v0.37.0...v0.38.0) (2024-04-25)

### BREAKING CHANGES

- CSS configuration deprecated in v0.25.0 is removed. See the [migration guide for v0.25.0][uc-uploader-docs-migration-0-25-0] for more details.
- Localizations are removed from CSS. <br/>Now we have a special API `defineLocale`, and `locale-name` and `locale-definition-override` options. See the [migration guide][uc-uploader-docs-migration-0-38-0] for more details.

[uc-uploader-docs-migration-0-25-0]: https://uploadcare.com/docs/file-uploader/migration-to-0.25.0/
[uc-uploader-docs-migration-0-38-0]: https://uploadcare.com/docs/file-uploader/migration-to-0.38.0/

# [0.37.0](https://github.com/uploadcare/blocks/compare/v0.36.0...v0.37.0) (2024-04-15)

### Bug Fixes

- activity switch races ([#643](https://github.com/uploadcare/blocks/issues/643)) ([fe365da](https://github.com/uploadcare/blocks/commit/fe365dadea7a720b1f349de336aacc0d515f39cf))
- define config DOM property accessors on the class prototype to make it compatible with framework bindings ([#638](https://github.com/uploadcare/blocks/issues/638)) ([d47baf0](https://github.com/uploadcare/blocks/commit/d47baf0bb91355cd30411b5f2a8910606d5a1fe0))

### Features

- added export UID from @symbiotejs/symbiote ([#636](https://github.com/uploadcare/blocks/issues/636)) ([9666f21](https://github.com/uploadcare/blocks/commit/9666f21ce2b97f283839ec39b5d480dd298f3415))

# [0.36.0](https://github.com/uploadcare/blocks/compare/v0.35.2...v0.36.0) (2024-03-21)

### Bug Fixes

- don't try to open empty modal on mobile when camera is the only source ([#634](https://github.com/uploadcare/blocks/issues/634)) ([1bc4f5d](https://github.com/uploadcare/blocks/commit/1bc4f5dde831f69f7dc86c2ed7a60aa2c1537506))

### Features

- added export event type ([#632](https://github.com/uploadcare/blocks/issues/632)) ([c292d16](https://github.com/uploadcare/blocks/commit/c292d16b4e4accde65af853e21f9804981e8a4ac))

## [0.35.2](https://github.com/uploadcare/blocks/compare/v0.35.1...v0.35.2) (2024-03-08)

### Bug Fixes

- **image-shrink:** fallback algo on Firefox and iOS ([#630](https://github.com/uploadcare/blocks/issues/630)) ([066cfca](https://github.com/uploadcare/blocks/commit/066cfca3306c65f0c4e67332311763a2bf2ea4ef))

## [0.35.1](https://github.com/uploadcare/blocks/compare/v0.35.0...v0.35.1) (2024-03-07)

### Bug Fixes

- improve uploading progress animation ([#628](https://github.com/uploadcare/blocks/issues/628)) ([a1db063](https://github.com/uploadcare/blocks/commit/a1db063234a8227614d446e32aa2b5edf149d7f4))

# [0.35.0](https://github.com/uploadcare/blocks/compare/v0.34.0...v0.35.0) (2024-03-07)

### Bug Fixes

- **minimal:** open system dialog on `add more` button ([#626](https://github.com/uploadcare/blocks/issues/626)) ([0098600](https://github.com/uploadcare/blocks/commit/00986000d61b9550ce2bfba3368bf523e91fdcfd))

### Features

- add `removeAllFiles` API method ([#624](https://github.com/uploadcare/blocks/issues/624)) ([85ef970](https://github.com/uploadcare/blocks/commit/85ef97018548ff13ec49f3aa76bf5cf3019f6c79))

# [0.34.0](https://github.com/uploadcare/blocks/compare/v0.33.2...v0.34.0) (2024-03-05)

### Bug Fixes

- show camera system dialog when camera is the only source ([95f0287](https://github.com/uploadcare/blocks/commit/95f02872f2e4b60bf7e4558b28cceb25d727a346))
- specify camera input accept attribute value as simple `image/*` to prevent OS to show unrelated sources (video/audio) ([5ecacba](https://github.com/uploadcare/blocks/commit/5ecacba610143f1336b2fde2b6cf67a7f17c1edb))
- switch camera source output format to JPEG to make it shrinkable ([6da4212](https://github.com/uploadcare/blocks/commit/6da4212358146c8414443fff9698a53657891f23))

### Features

- add `cameraCapture` option to specify inpit capture attribute value ([9a77057](https://github.com/uploadcare/blocks/commit/9a7705701ea60dd407af8284f72b4e57f8272e04))
- **lr-upload-ctx-provider:** add method `addFileFromCdnUrl` to add already uploaded files with predefined cdn url modifiers ([#617](https://github.com/uploadcare/blocks/issues/617)) ([8043d08](https://github.com/uploadcare/blocks/commit/8043d085a996086b52f0205f07438d67d5e8acbe))
- **lr-upload-ctx-provider:** add method `removeFileByInternalId` ([#618](https://github.com/uploadcare/blocks/issues/618)) ([c2492eb](https://github.com/uploadcare/blocks/commit/c2492eb1a15ce36fc4db3352665d05f9674076bc))

## [0.33.2](https://github.com/uploadcare/blocks/compare/v0.33.1...v0.33.2) (2024-02-20)

### Bug Fixes

- set `cdnUrlModifers` default to empty string after file upload ([#613](https://github.com/uploadcare/blocks/issues/613)) ([7113058](https://github.com/uploadcare/blocks/commit/7113058d2293760225c032eaf32ee93399a422cf))

## [0.33.1](https://github.com/uploadcare/blocks/compare/v0.33.0...v0.33.1) (2024-02-20)

### Bug Fixes

- **shadow-wrapper:** wait for `shadowStyles` load before calling `shadowReadyCallback` ([#611](https://github.com/uploadcare/blocks/issues/611)) ([42b73b7](https://github.com/uploadcare/blocks/commit/42b73b7de129999da9ad61148c0599b5fa81964e))

# [0.33.0](https://github.com/uploadcare/blocks/compare/v0.32.4...v0.33.0) (2024-02-16)

### Bug Fixes

- progress calculation errors when file is removed during uploading ([#606](https://github.com/uploadcare/blocks/issues/606)) ([74769ce](https://github.com/uploadcare/blocks/commit/74769ce3ead25bfbc72b5aecf3448702e417c373))

### Features

- Add image shrink to the uploader ([e2b0896](https://github.com/uploadcare/blocks/commit/e2b0896ea02a4f959e02fbcfba84cdb7c8031368)). See docs [here](https://uploadcare.com/docs/file-uploader/feature-shrink/)

## [0.32.4](https://github.com/uploadcare/blocks/compare/v0.32.3...v0.32.4) (2024-02-15)

### Bug Fixes

- **cloud-image-editor:** disable image enter transition ([2abe55f](https://github.com/uploadcare/blocks/commit/2abe55f0b6d1ae4f46dc895fdf00646d81a11011))
- **cloud-image-editor:** weird ui glitches when updating `cdnUrl` on change ([c264c64](https://github.com/uploadcare/blocks/commit/c264c6494f88cb1307ac83f5e811da8ac334a54b))

## [0.32.3](https://github.com/uploadcare/blocks/compare/v0.32.2...v0.32.3) (2024-02-13)

### Bug Fixes

- server validation error rendering ([#604](https://github.com/uploadcare/blocks/issues/604)) ([3e9835b](https://github.com/uploadcare/blocks/commit/3e9835bafb5ba16c1853a68f395428b31a8093f0))

## [0.32.2](https://github.com/uploadcare/blocks/compare/v0.32.1...v0.32.2) (2024-02-12)

### Bug Fixes

- **form-input:** do not append `[]` postfix to input name when `multiple` is falsy ([#602](https://github.com/uploadcare/blocks/issues/602)) ([4722c4d](https://github.com/uploadcare/blocks/commit/4722c4d0eb1890013d6693376ff655dd871798d1))

## [0.32.1](https://github.com/uploadcare/blocks/compare/v0.32.0...v0.32.1) (2024-02-06)

### Bug Fixes

- bump upload-client to fix large groups uploading ([#599](https://github.com/uploadcare/blocks/issues/599)) ([cb61448](https://github.com/uploadcare/blocks/commit/cb61448a2ae85c3076d41bcae85ee1fe7b6d2659))

# [0.32.0](https://github.com/uploadcare/blocks/compare/v0.31.1...v0.32.0) (2024-02-05)

### Breaking changes

- Global events are removed. I.e. `window.addEventListener('LR_UPLOAD_FINISH', ...)` will not work anymore. Now you need to use `lr-upload-ctx-provider` block to subscribe to the events. See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.32.0/) for more details.
- All existing events and their payloads are changed. See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.32.0/) for more details.
- `lr-data-output` block is removed.
  - To handle HTML forms you need to use `lr-form-input` block.
  - Groups output moved to the `lr-upload-ctx-provider` events
  - Console debugging output now enabled with the `debug` attribute on `lr-config`
- `lr-message-box` block is removed.

See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.32.0/) for more details.

## [0.31.1](https://github.com/uploadcare/blocks/compare/v0.31.0...v0.31.1) (2024-01-30)

### Bug Fixes

- **image-editor:** fix flip operation serialization ([#595](https://github.com/uploadcare/blocks/issues/595)) ([140df3a](https://github.com/uploadcare/blocks/commit/140df3a71df6008faa363c99767c87c0640d492b))

# [0.31.0](https://github.com/uploadcare/blocks/compare/v0.30.9...v0.31.0) (2024-01-29)

### Bug Fixes

- **file-item:** file status icon align ([#593](https://github.com/uploadcare/blocks/issues/593)) ([1539abe](https://github.com/uploadcare/blocks/commit/1539abe5a75b2673415e999a8ad63aaff664776f))

### Features

- **lr-img:** preview blur ([f42967a](https://github.com/uploadcare/blocks/commit/f42967aec0b77c454750286dae74f4aa00124d3f))

## [0.30.9](https://github.com/uploadcare/blocks/compare/v0.30.8...v0.30.9) (2024-01-18)

### Bug Fixes

- **cloud-image-editor:** ignore unsupported cdn operations and print console warning ([#587](https://github.com/uploadcare/blocks/issues/587)) ([503eaae](https://github.com/uploadcare/blocks/commit/503eaaed216d2f8aa3c84cd5bead2d27136b3a5f))
- **external-source:** disallow to select multiple files when multiple mode is off ([#589](https://github.com/uploadcare/blocks/issues/589)) ([d5c43cd](https://github.com/uploadcare/blocks/commit/d5c43cd565c7391c998a7ee6941f5fab6fe90c63))

## [0.30.8](https://github.com/uploadcare/blocks/compare/v0.30.7...v0.30.8) (2023-12-29)

### Bug Fixes

- **shadow-wrapper:** do not call success callback on the second `css-src` attribute change ([#583](https://github.com/uploadcare/blocks/issues/583)) ([eb9618a](https://github.com/uploadcare/blocks/commit/eb9618a3c3b579c5440c25444fb2a61bfbd55d6e))

## [0.30.7](https://github.com/uploadcare/blocks/compare/v0.30.6...v0.30.7) (2023-12-27)

### Features

- **lr-img:** Do not append `-/format/auto/` and `-/quality/smart/` by default to the resulting CDN URL. Now, the defaults of these settings are preserved within the project settings on the dashboard. See the release notes for the [Auto formatting](https://uploadcare.com/docs/changelog/#2023-12-21) and [CDN updates](https://uploadcare.com/docs/changelog/#2023-10-09).

### Bug fixes

- **lr-img:**: Ignore breakpoints config when applying `image-set` for the background image using `is-background-for` option.

## [0.30.6](https://github.com/uploadcare/blocks/compare/v0.30.5...v0.30.6) (2023-12-20)

### Bug Fixes

- **upload-ctx-provider:** execute destroy context callback async to ensure all sync callbacks are run ([#575](https://github.com/uploadcare/blocks/issues/575)) ([cbb9a21](https://github.com/uploadcare/blocks/commit/cbb9a2136c3079d98cd2db2474cf955cf9b9631e))

## [0.30.5](https://github.com/uploadcare/blocks/compare/v0.30.4...v0.30.5) (2023-12-07)

### Bug Fixes

- **activity-block:** check for the `*modalActive` key presence in state before subscribing it ([0e50b4f](https://github.com/uploadcare/blocks/commit/0e50b4f6dc2664eea7a7f12742660385a50610fd))
- destroy upload collection when the last block in context is being destroyed ([42e501a](https://github.com/uploadcare/blocks/commit/42e501a85d089b4863950482fd89d240102aeb7d))

## [0.30.4](https://github.com/uploadcare/blocks/compare/v0.30.3...v0.30.4) (2023-12-06)

### Bug Fixes

- **activity:** run activity deactivation callback when modal became closed ([2e84268](https://github.com/uploadcare/blocks/commit/2e842681cfac68594a5c85ce92969597d9302081))
- **cloud-image-editor:** do no try to update image when element is disconnected from DOM ([1b417a9](https://github.com/uploadcare/blocks/commit/1b417a93476da224c407ea60e95fa13ba4eefd1d))
- **cloud-image-editor:** init `*tabId` global state key in the main editor block instead of deeper toolbar block ([511d3e1](https://github.com/uploadcare/blocks/commit/511d3e1301c6fe0b4e0d4fdbf70b2484e38f88d0))
- **start-from:** add missing scroll area ([680a282](https://github.com/uploadcare/blocks/commit/680a28222f1107523bf3453cc8930bf4a399e8da))
- **window-height-tracker:** prevent infinite loop ([7576ece](https://github.com/uploadcare/blocks/commit/7576ece24a7254cc6d3985925db4ae56133fa790))

## [0.30.3](https://github.com/uploadcare/blocks/compare/v0.30.2...v0.30.3) (2023-12-04)

### Bug Fixes

- **block:** destroy both local and global contexts ([bdd4a33](https://github.com/uploadcare/blocks/commit/bdd4a330583e57cf9eda798453d4815cfe4f9d84))
- **cloud-image-editor:** destroy context ([deb9d25](https://github.com/uploadcare/blocks/commit/deb9d25e6ea60e17fa2682a077a1a74e2de77645))
- **config:** do not overwrite config values inside context ([c1f6a0f](https://github.com/uploadcare/blocks/commit/c1f6a0f1bfe5ec509e66a1a55603fed82f4f3175))
- **drop-area:** destroy global registry context if there are no items inside ([ad89e56](https://github.com/uploadcare/blocks/commit/ad89e56e0771ae064df9fb00996de69f2fe35323))
- **img:** destroy context ([05ba451](https://github.com/uploadcare/blocks/commit/05ba451ba139c860e701fe57195883c0f104534a))
- **typed-collection:** destroy context ([a7c136d](https://github.com/uploadcare/blocks/commit/a7c136d9d5a79eff68874c559276c1a0d84d658b))
- **upload-collection:** destroy upload collection ([bcc4d46](https://github.com/uploadcare/blocks/commit/bcc4d460fd7724a0d84cd4c40a065c67a6479d18))

## [0.30.2](https://github.com/uploadcare/blocks/compare/v0.30.1...v0.30.2) (2023-12-01)

### Bug Fixes

- **start-from:** styles ([#566](https://github.com/uploadcare/blocks/issues/566)) ([7367b1d](https://github.com/uploadcare/blocks/commit/7367b1d914b044cbce2c4fdb6a15e03cf68a9e61))
- **upload-ctx-provider:** run parent init callback before accessing event emitter ([#565](https://github.com/uploadcare/blocks/issues/565)) ([a313c5c](https://github.com/uploadcare/blocks/commit/a313c5c3b61f4749c6919a6d078e18e7eaa73419))

## [0.30.1](https://github.com/uploadcare/blocks/compare/v0.30.0...v0.30.1) (2023-11-30)

### Bug Fixes

- improve event types ([#563](https://github.com/uploadcare/blocks/issues/563)) ([7d4097d](https://github.com/uploadcare/blocks/commit/7d4097db83f2cd4afef6375406e92afb0eba4c09))

# [0.30.0](https://github.com/uploadcare/blocks/compare/v0.29.1...v0.30.0) (2023-11-14)

- **drop-area:** show pointer on clickable drop areas ([6990cd4](https://github.com/uploadcare/blocks/commit/6990cd495ac535fcb9586e3148dcf5a4705035ae))

### Features

- add `cancel` button on the start from activity ([#554](https://github.com/uploadcare/blocks/issues/554)) ([44bd845](https://github.com/uploadcare/blocks/commit/44bd8452a1f720d2c21444f64b5a74c0ffe26880))
- move global events to the `lr-upload-ctx-provider` scope ([c452eeb](https://github.com/uploadcare/blocks/commit/c452eeb4e90b2969409046116fa8786da66ec811))

## [0.29.1](https://github.com/uploadcare/blocks/compare/v0.29.0...v0.29.1) (2023-10-31)

### Bug Fixes

- **modal:** buggy click handlers to close modal on outside click ([#551](https://github.com/uploadcare/blocks/issues/551)) ([8949948](https://github.com/uploadcare/blocks/commit/8949948cebbe84e9d29d6537321c6520caa567d1))
- **types:** bump @uploadcare/upload-client with fixed types for `imageInfo.datetimeOriginal` ([#550](https://github.com/uploadcare/blocks/issues/550)) ([8babfab](https://github.com/uploadcare/blocks/commit/8babfab3b2f3ae021ab69340570547f565711e6e))

# [0.29.0](https://github.com/uploadcare/blocks/compare/v0.28.0...v0.29.0) (2023-10-27)

### Features

- add property `fullPath` to the output entry ([9e4707f](https://github.com/uploadcare/blocks/commit/9e4707fef14df91d29c5172585d23ac912115c71))
- pass output entry to the metadata callback ([9153826](https://github.com/uploadcare/blocks/commit/915382619280fdadedac474ee4167cd52982685b))

```ts
config.metadata = (fileEntry) => ({
  type: 'cat',
  fileName: fileEntry.name,
  fullPath: fileEntry.fullPath,
});
```

# [0.28.0](https://github.com/uploadcare/blocks/compare/v0.27.6...v0.28.0) (2023-10-26)

### BREAKING CHANGES

#### `LR_DATA_OUTPUT` event on window

Before: The `LR_DATA_OUTPUT` event only contained uploaded files and fired only when a file was uploaded, deleted, or edited.

Now: The `LR_DATA_OUTPUT` event now includes all the files in the upload list, including those not yet uploaded, and it fires whenever there is any change in the file list.
The event firing is debounced with a 100ms delay. So, in this event, you receive a complete snapshot of the upload list's state. \*_Please note_ that if the file hasn't been uploaded yet, the data will be incomplete. Properties such as `uuid`, `cdnUrl` and others will not be accessible. Before accessing them, you should check the `isUploaded` flag, which is described below.

```js
window.addEventListener('LR_DATA_OUTPUT', (e) => {
  const entries = e.detail.data;
  for (const entry of entries) {
    if (entry.isUploaded) {
      console.log('Uploaded', entry.uuid);
    } else {
      console.log('Not uploaded', entry.uploadProgress);
    }
  }
});
```

- make `LR_DATA_OUTPUT` event frequent and contain all the files ([69105e4](https://github.com/uploadcare/blocks/commit/69105e4806e9ca2d4254bce297c48e0990663212))

#### `lr-data-output` event on `lr-data-output` block (tag)

Before: The `lr-data-output` event mirrors the `LR_DATA_OUTPUT` event. When the `group-output` option is enabled or the `use-group` attribute is present, it always creates a group for the file list.

Now: The `lr-data-output` event mirrors the `LR_DATA_OUTPUT` event. When the `group-output` option is enabled or the `use-group` attribute is present, a group is only created if all files are uploaded, and there are no validation errors.
Otherwise, the event contains undefined `groupData` and a list of files.

### Features

#### New file properties for the events payload

The following events are affected:

- `LR_DATA_OUTPUT`
- `LR_UPLOAD_FINISH`
- `LR_REMOVE`
- `LR_UPLOAD_START`
- `lr-data-output`

What file properties have been added:

```ts
validationErrorMessage: string | null; // message with the validation error
uploadError: Error | null; // error object with the upload error
file: File | Blob | null; // file object
externalUrl: string | null; // external URL for the file (when uploading from URL or external source)
isValid: boolean; // is file valid (passed validation checks)
isUploaded: boolean; // is file uploaded
uploadProgress: number; // upload progress in percents
```

- add new properties to the output file entry ([2821bf3](https://github.com/uploadcare/blocks/commit/2821bf381b7ed32c1ffe8908d8c71a86eaef9fde))

#### `lr-data-output` now uses native validation to show errors

- **lr-data-output:** improve native form validation ([c329d4c](https://github.com/uploadcare/blocks/commit/c329d4c89b6735af373e234e6580a80fc830e320))

### Bug Fixes

- **lr-config:** validate passed settings ([6012581](https://github.com/uploadcare/blocks/commit/60125813b6b4d6ff16fbecf96e0b6178c4ef106f))
- show inline validation message for the `multiple-min` requirement check fail ([8af0fec](https://github.com/uploadcare/blocks/commit/8af0fec7015516a94791f30be48863fa10488a8b))

## [0.27.6](https://github.com/uploadcare/blocks/compare/v0.27.5...v0.27.6) (2023-10-20)

### Bug Fixes

- **minimal-mode:** add file button should open system dialog ([#544](https://github.com/uploadcare/blocks/issues/544)) ([366d524](https://github.com/uploadcare/blocks/commit/366d524487d19a7d5b46bc39b023ea904fe6d835))

## [0.27.5](https://github.com/uploadcare/blocks/compare/v0.27.4...v0.27.5) (2023-10-19)

### Bug Fixes

- **types:** add missing `LR_CLOUD_MODIFICATION` JSX type ([#542](https://github.com/uploadcare/blocks/issues/542)) ([3307b25](https://github.com/uploadcare/blocks/commit/3307b25ff8948fd87292839664765533df8ed40b))

## [0.27.4](https://github.com/uploadcare/blocks/compare/v0.27.3...v0.27.4) (2023-10-12)

### Bug Fixes

- require `ctx-name` attribute for all the public blocks and wait for it with 300ms timeout ([11d5a94](https://github.com/uploadcare/blocks/commit/11d5a94c9131398138eda27011616745ee4b45fe))

## [0.27.3](https://github.com/uploadcare/blocks/compare/v0.27.2...v0.27.3) (2023-10-10)

### Bug Fixes

- **cloud-image-editor:** make `crop-preset` and `tabs` attributes reactive ([8545c71](https://github.com/uploadcare/blocks/commit/8545c716f4b1e0a6adf55fcdb4c0c921f8cfd852))
- **uploader:** append `preview` operation when setting initial crop with `crop-preset` defined ([5f1036c](https://github.com/uploadcare/blocks/commit/5f1036c5cafa3b7293f214b51a604a3ea53822e5))

## [0.27.2](https://github.com/uploadcare/blocks/compare/v0.27.1...v0.27.2) (2023-10-10)

### Bug Fixes

- capture and store file's full path while getting drag'n'dropped ([#536](https://github.com/uploadcare/blocks/issues/536)) ([3ba168e](https://github.com/uploadcare/blocks/commit/3ba168ee955a3b3231ca42c7112963fa2ff240cb))

## [0.27.1](https://github.com/uploadcare/blocks/compare/v0.27.0...v0.27.1) (2023-10-06)

### Bug Fixes

- **init-flow:** fix sync `initFlow` calls right after upload collection ([#532](https://github.com/uploadcare/blocks/issues/532)) ([f4f4dea](https://github.com/uploadcare/blocks/commit/f4f4dea6014275faf7d6e50b6cf8c7dbdad449aa))

# [0.27.0](https://github.com/uploadcare/blocks/compare/v0.26.0...v0.27.0) (2023-10-06)

### Bug Fixes

- **drag-n-drop:** do not show drop cursor when it's not over the drop target ([05a08dc](https://github.com/uploadcare/blocks/commit/05a08dc7206b451e0d4fcd14599d4415f317631b))

### Features

- **simple-btn:** add flag to toggle drop-zone ([5f4fae2](https://github.com/uploadcare/blocks/commit/5f4fae27738e77dfeb11284ab8f38b4cdf3c57d5))

Example:

```js
class CustomSimpleBtn extends LR.SimpleBtn {
  dropzone = false;
}

LR.registerBlocks({ ...LR, SimpleBtn: CustomSimpleBtn });
```

or

```html
<lr-simple-btn dropzone="false"></lr-simple-btn>
```

# [0.26.0](https://github.com/uploadcare/blocks/compare/v0.25.6...v0.26.0) (2023-10-03)

### Features

#### New option `cloudImageEditorTabs`

Defines the list of tabs in the cloud image editor. See the [configuration reference](https://uploadcare.com/docs/file-uploader/options/#cloud-image-editor-tabs) for more details.

- **cloud-image-editor:** add ability to hide unnecessary editor tabs (crop, tuning or filters) ([af15f51](https://github.com/uploadcare/blocks/commit/af15f514f8eb787d25409efbd392e8c17deae0db))

#### New option `cropPreset`

Defines the crop behavior. When uploading images, your users can select a crop area with defined aspect ratio. See the [configuration reference](https://uploadcare.com/docs/file-uploader/options/#crop-preset) for more details.

- **cloud-image-editor:** add crop preset setting ([923f4ca](https://github.com/uploadcare/blocks/commit/923f4ca975c6829fc5ca02271c053b2c427ba72c))
- **uploader:** force defined aspect ration for the output images ([26eda66](https://github.com/uploadcare/blocks/commit/26eda66729e230e2197a8c6a2d879cc9220e850b))

### Fixes

- **external-sources:** add files to the upload list after done button click ([0089370](https://github.com/uploadcare/blocks/commit/00893706332ab1a9de4d62e1fc9c51fba952ae08))

## [0.25.6](https://github.com/uploadcare/blocks/compare/v0.25.5...v0.25.6) (2023-09-01)

### Bug Fixes

- **types:** shadow wrapper static fields mixin ([#522](https://github.com/uploadcare/blocks/issues/522)) ([a65435c](https://github.com/uploadcare/blocks/commit/a65435cd1fc1ecc109a23af306b50d10323693d9))

## [0.25.5](https://github.com/uploadcare/blocks/compare/v0.25.4...v0.25.5) (2023-08-28)

### Bug Fixes

- **types:** events types export for angular projects ([#518](https://github.com/uploadcare/blocks/issues/518)) ([daf3c2c](https://github.com/uploadcare/blocks/commit/daf3c2c822bf90d0981efab1636bf8457d0fd417))

## [0.25.4](https://github.com/uploadcare/blocks/compare/v0.25.3...v0.25.4) (2023-08-08)

### Bug Fixes

- **add-file-from:** handle upload collection initial state when called before initialization ([6f932d3](https://github.com/uploadcare/blocks/commit/6f932d32327bffd9622e3a6e41cf383efe00d355))
- **inline:** show upload list if there are any file in the list ([96e44e6](https://github.com/uploadcare/blocks/commit/96e44e6dc7cbf10328eabd66c1a8bbb1032a007d))
- **minimal:** show upload list if there are any file in the list ([174c4a7](https://github.com/uploadcare/blocks/commit/174c4a77f0acd297add06e6e01de1a7db100ac64))

## [0.25.3](https://github.com/uploadcare/blocks/compare/v0.25.2...v0.25.3) (2023-08-08)

### Bug Fixes

- **minimal:** add exports of `lr-config` and `upload-ctx-provider` ([#506](https://github.com/uploadcare/blocks/issues/506)) ([8049e6f](https://github.com/uploadcare/blocks/commit/8049e6fdee1abb7f1fdae2c81acb413b8bfb02db))

## [0.25.2](https://github.com/uploadcare/blocks/compare/v0.25.1...v0.25.2) (2023-08-07)

## [0.25.1](https://github.com/uploadcare/blocks/compare/v0.25.0...v0.25.1) (2023-07-24)

### Bug Fixes

- **cloud-image-editor:** fix `initEditor` type ([#502](https://github.com/uploadcare/blocks/issues/502)) ([6c222d5](https://github.com/uploadcare/blocks/commit/6c222d595e9a0e578473af616a45ba1d5fda9884))

## [0.25.0](https://github.com/uploadcare/blocks/compare/v0.24.2...v0.25.0) (2023-07-24)

### BREAKING CHANGES

1. Configuration in CSS is now deprecated.
   Although it currently works, it will be removed shortly.
   In lieu of this, we are introducing a new lr-config block for configuration definitions.

2. The `css-src` attribute is now required on solution blocks.
   This implies that the use of Shadow DOM is enforced.

3. The `ctx-name` attribute is required for the each block on the page.

4. Method `setUploadMetadata` is deprecated in favour of `metadata` DOM property
   on the `lr-config` block.

5. `CloudEditor` (`lr-cloud-editor`) solution block is renamed to
   `CloudImageEditor` (`lr-cloud-image-editor`).

6. `CloudImageEditor` (`lr-cloud-image-editor`) activity is was renamed to
   `CloudImageEditorActivity` (`lr-cloud-image-editor-activity`).

7. All solution bundles are prefixed with `lr-` prefix:

- `file-uploader-regular.min.js` -> `lr-file-uploader-regular.min.js`
- `file-uploader-regular.min.css` -> `lr-file-uploader-regular.min.css`
- `file-uploader-inline.min.js` -> `lr-file-uploader-inline.min.js`
- `file-uploader-inline.min.css` -> `lr-file-uploader-inline.min.css`
- `file-uploader-minimal.min.js` -> `lr-file-uploader-minimal.min.js`
- `file-uploader-minimal.min.css` -> `lr-file-uploader-minimal.min.css`

8. Solution bundles do not automatically register blocks.
   You will need to manually register them:

```js
import * as LR from 'https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.js';

LR.registerBlocks(LR);
```

9. Bundle `blocks.iife.js` is renamed to `blocks.iife.min.js`.

10. Bundle `blocks-browser.min.js` is deprecated. Use `blocks.iife.min.js`
    instead.

### How to migrate

This migration guide is also available at: https://uploadcare.com/docs/file-uploader/migration-to-0.25.0/

#### Configuration

First and foremost, you need to shift all the configuration from CSS to the `lr-config` block.
For instance, if you have the following CSS:

```css
.config {
  --ctx-name: 'my-uploader';
  --cfg-pubkey: 'YOUR_PUBLIC_KEY';
  --cfg-multiple-min: 0;
  --cfg-multiple-max: 3;
}
```

Move it to the `lr-config` block:

```html
<lr-config ctx-name="my-uploader" pubkey="YOUR_PUBLIC_KEY" multiple-min="0" multiple-max="3"></lr-config>
```

Subsequently, you should link your solution block to the `lr-config` block using the `ctx-name` attribute:

```html
<lr-file-uploader-regular
  ctx-name="my-uploader"
  css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.css"
></lr-file-uploader-regular>
```

The property names remain the same but without the `--cfg` prefix. For example,
`--cfg-pubkey` becomes simply `pubkey`.

See the [configuration reference][file-uploader-configuration] for more details.

#### Dynamic configuration updates

If you have dynamically updated CSS configuration like this:

```js
const uploader = document.querySelector('lr-file-uploader-regular');
uploader.style.setProperty('--cfg-pubkey', 'YOUR_PUBLIC_KEY');

const uploaderCtx = document.querySelector('lr-upload-ctx-provider');
uploaderCtx.updateCtxCssData();
```

You need to update it to the following:

```js
const config = document.querySelector('lr-config');
config.setAttribute('pubkey', 'YOUR_PUBLIC_KEY'); // using attribute
config.pubkey = 'YOUR_PUBLIC_KEY'; // or using DOM property
```

Both attributes and DOM properties are reactive so you don't need to call
`updateCtxCssData` anymore.

#### Shadow DOM and `css-src`

Shadow DOM is now enforced for all the solution blocks. It means that you need
to use `css-src` attribute to attach CSS to the block.

If you previously attached CSS to the global like this:

```html
<link href="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.css" rel="stylesheet" />

<lr-file-uploader-regular class="lr-wgt-common"></lr-file-uploader-regular>
```

You need to use `css-src` attribute instead:

```html
<lr-file-uploader-regular
  css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.css"
></lr-file-uploader-regular>
```

(Other attributes are omitted for brevity)

#### `ctx-name` attribute

`ctx-name` attribute is required for all the blocks now even if you have only
one block on the page. It's used to wire blocks to the `lr-config` block. For
example:

```html
<lr-config ctx-name="my-uploader"></lr-config>
<lr-file-uploader-regular ctx-name="my-uploader"></lr-file-uploader-regular>
<lr-upload-ctx-provider ctx-name="my-uploader"></lr-upload-ctx-provider>
<lr-data-output ctx-name="my-uploader"></lr-data-output>
```

(Other attributes are omitted for brevity)

#### Replace `setUploadMetadata` with `metadata` DOM property

If you was using `setUploadMetadata` method like this:

```js
uploaderCtxProvider.setUploadMetadata({ foo: 'bar' });
```

You need to replace it with `metadata` DOM property on the `lr-config` block:

```js
const config = document.querySelector('lr-config');
config.metadata = { foo: 'bar' };
// or
config.metadata = () => Promise.resolve({ foo: 'bar' });
```

See the [configuration reference][file-uploader-option-metadata] for more details.

#### Rename `CloudEditor` -> `CloudImageEditor`

If you was using standalone `lr-cloud-editor` solution block, you need to rename
it to `lr-cloud-image-editor` like this:

```html
<lr-cloud-image-editor
  uuid="7c167b79-9f27-4489-8032-3f3be1840605"
  css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-cloud-image-editor.min.css"
  ctx-name="my-editor"
></lr-cloud-image-editor>
```

#### Rename `CloudImageEditor` -> `CloudImageEditorActivity`

If you was using `lr-cloud-image-editor` activity block inside your custom
Symbiote.js templates, you need to rename it to `lr-cloud-image-editor-activity`
like this:

```js
FileUploaderRegular.template = /* HTML */ `
  <lr-simple-btn></lr-simple-btn>

  <lr-modal strokes block-body-scrolling>
    <lr-start-from>
      <lr-drop-area with-icon clickable></lr-drop-area>
      <lr-source-list wrap></lr-source-list>
      <lr-copyright></lr-copyright>
    </lr-start-from>
    <lr-upload-list></lr-upload-list>
    <lr-camera-source></lr-camera-source>
    <lr-url-source></lr-url-source>
    <lr-external-source></lr-external-source>
    <lr-cloud-image-editor-activity></lr-cloud-image-editor-activity>
    <!-- here it is -->
  </lr-modal>

  <lr-message-box></lr-message-box>
  <lr-progress-bar-common></lr-progress-bar-common>
`;
```

#### Rename imported JS and CSS bundles

Just rename all the imports according to the following table:

| Old name                        | New name                           |
| ------------------------------- | ---------------------------------- |
| `file-uploader-regular.min.js`  | `lr-file-uploader-regular.min.js`  |
| `file-uploader-regular.min.css` | `lr-file-uploader-regular.min.css` |
| `file-uploader-inline.min.js`   | `lr-file-uploader-inline.min.js`   |
| `file-uploader-inline.min.css`  | `lr-file-uploader-inline.min.css`  |
| `file-uploader-minimal.min.js`  | `lr-file-uploader-minimal.min.js`  |
| `file-uploader-minimal.min.css` | `lr-file-uploader-minimal.min.css` |

For example:

```html
<script type="module">
  import * as LR from 'https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/file-uploader-regular.min.js';
  LR.registerBlocks(LR);
</script>

<lr-config ctx-name="my-uploader" pubkey="YOUR_PUBLIC_KEY"></lr-config>

<lr-file-uploader-regular
  ctx-name="my-uploader"
  css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/file-uploader-regular.min.css"
></lr-file-uploader-regular>
```

Became:

```html
<script type="module">
  import * as LR from 'https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.js';
  LR.registerBlocks(LR);
</script>

<lr-config ctx-name="my-uploader" pubkey="YOUR_PUBLIC_KEY"></lr-config>

<lr-file-uploader-regular
  ctx-name="my-uploader"
  css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.css"
></lr-file-uploader-regular>
```

#### Call `registerBlocks` manually

If you have installed blocks using `min.js` bundles, you need to call
`registerBlocks` manually:

```html
<script type="module">
  import * as LR from 'https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.js';
  LR.registerBlocks(LR);
</script>
```

#### Rename `blocks.iife.js` to `blocks.iife.min.js`

If you previously used the `blocks.iife.js` bundle, you need to rename it to
`blocks.iife.min.js` as follows:

```html
<script src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/blocks.iife.min.js" async />
```

#### Rename `blocks-browser.min.js` to `blocks.iife.min.js`

If you were using the `connectBlocksFrom` method in conjunction with the
`blocks-browser.min.js` bundle, you need to rename it to `blocks.iife.min.js`,
as shown below:

```js
connectBlocksFrom('https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/blocks.iife.min.js').then((LR) => {
  LR.registerBlocks(LR);
  //  ...
});
```

If you were using `blocks-browser.min.js` via a `script` tag with `type="module"`,
you need to rename it to `blocks.min.js`, as shown below:

```html
<script type="module">
  import * as LR from 'https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/blocks.min.js';

  LR.registerBlocks(LR);
</script>
```

If you were using `blocks-browser.min.js` via a `script` tag without
`type="module"`, you need to rename it to `blocks.iife.min.js`, as shown below:

```html
<script src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/blocks.iife.min.js" async />
```

## [0.24.2](https://github.com/uploadcare/blocks/compare/v0.24.1...v0.24.2) (2023-07-20)

### Changes

- update readme

## [0.24.1](https://github.com/uploadcare/blocks/compare/v0.24.0...v0.24.1) (2023-06-27)

### Bug Fixes

- **url-source:** enable input autofocus, form submit, value clear on submit ([#495](https://github.com/uploadcare/blocks/issues/495)) ([552cad3](https://github.com/uploadcare/blocks/commit/552cad3ed9470c904e5f0d3c123aad3e8cb932d6))

# [0.24.0](https://github.com/uploadcare/blocks/compare/v0.23.0...v0.24.0) (2023-06-21)

### Bug Fixes

- **drag-n-drop:** copy `type` value from `DataTransferItem` to `FileSystemFileEntry` when doing drag'n'drop because `FileSystemFileEntry` don't resolve type for HEIC ([832ed55](https://github.com/uploadcare/blocks/commit/832ed55814b58bf133a6881caef223f1a0d7a446))
- get `mimeType` from upload API from both `contentInfo` and provided type ([33cf2f7](https://github.com/uploadcare/blocks/commit/33cf2f77291c70cd065fd7b9c3c9f174688590d0))
- **validation:** skip client validation if mime type or file name aren't available ([0d7a96f](https://github.com/uploadcare/blocks/commit/0d7a96ff27535f4f24449796d73b1b3acd9fde34))

### Features

- add icons for flickr, evernote, box, onedrive, huddle ([#490](https://github.com/uploadcare/blocks/issues/490)) ([30ae37d](https://github.com/uploadcare/blocks/commit/30ae37db5823f509764b019e0bdc3c8c254ffbea))

# [0.23.0](https://github.com/uploadcare/blocks/compare/v0.22.13...v0.23.0) (2023-06-14)

### Features

- add `uploadAll` method to trigger upload ([db69508](https://github.com/uploadcare/blocks/commit/db69508d84838937440d3fb119ff20d0dc6575f6))
- add separate `addFileFromUrl`, `addFileFromUuid` and `addFileFromObject` ([b5a89c4](https://github.com/uploadcare/blocks/commit/b5a89c4d51d68527c61a69cd55d96dcba892ee70))

### Deprecations

- method `addFiles` is deprecated in favour of `addFileFromUrl`, `addFileFromUuid` and `addFileFromObject` above

### API

```js
// `silent` option supresses `LR_UPLOAD_FINISH` event
// `fileName` options specifies file name
uploaderCtx.addFileFromUrl(url: string, { silent?: boolean, fileName?: string } = {});
uploaderCtx.addFileFromUuid(uuid: string, { silent?: boolean, fileName?: string } = {});
uploaderCtx.addFileFromObject(file: File, { silent?: boolean, fileName?: string } = {});

// Trigger uploading. Useful with `--cfg-confirm-upload: 1;` to force uploading predefined files.
uploaderCtx.uploadAll();
```

## [0.22.13](https://github.com/uploadcare/blocks/compare/v0.22.12...v0.22.13) (2023-06-14)

### Bug Fixes

- **external-source:** safari iframe height ([#479](https://github.com/uploadcare/blocks/issues/479)) ([88b54d8](https://github.com/uploadcare/blocks/commit/88b54d8eaacc4f4ff40f6d8a89ed2c3b71ece48e))
- **instagram:** scaled & cropped photos ([#484](https://github.com/uploadcare/blocks/issues/484)) ([9f71221](https://github.com/uploadcare/blocks/commit/9f712217983e4a25dffbd2740e80a92fb2132fdd))

## [0.22.12](https://github.com/uploadcare/blocks/compare/v0.22.11...v0.22.12) (2023-06-09)

### Features

- add IIFE bundle `web/blocks.iife.js` ([#480](https://github.com/uploadcare/blocks/pull/480))

## [0.22.11](https://github.com/uploadcare/blocks/compare/v0.22.10...v0.22.11) (2023-06-08)

### Bug Fixes

- skip validation if no allowed file types provided ([#477](https://github.com/uploadcare/blocks/issues/477)) ([e241993](https://github.com/uploadcare/blocks/commit/e241993f46d57840abf287eb47314cace1ba1058))

## [0.22.10](https://github.com/uploadcare/blocks/compare/v0.22.9...v0.22.10) (2023-06-08)

### Bug Fixes

- **file-item:** `--cfg-img-only` for external sources causing error ([#475](https://github.com/uploadcare/blocks/issues/475)) ([479db7b](https://github.com/uploadcare/blocks/commit/479db7b5ea7bf467a4a29819628347a31992acdc))

## [0.22.9](https://github.com/uploadcare/blocks/compare/v0.22.8...v0.22.9) (2023-06-05)

### Bug Fixes

- **copyright:** not working --cfg-remove-copyright config option ([#473](https://github.com/uploadcare/blocks/issues/473)) ([e925c7b](https://github.com/uploadcare/blocks/commit/e925c7b2e03c9833c12f7e2a54baa0b23f11fe2e))

## [0.22.8](https://github.com/uploadcare/blocks/compare/v0.22.7...v0.22.8) (2023-05-31)

### Bug Fixes

- make file extension validation case-insensitive ([#471](https://github.com/uploadcare/blocks/issues/471)) ([ae87b6b](https://github.com/uploadcare/blocks/commit/ae87b6be883de9e95e9afe0592b4a14a9f3d873c))

## [0.22.7](https://github.com/uploadcare/blocks/compare/v0.22.6...v0.22.7) (2023-05-29)

### Bug Fixes

- **cloud-editor:** double init ([#469](https://github.com/uploadcare/blocks/issues/469)) ([aae43ee](https://github.com/uploadcare/blocks/commit/aae43ee8b04e5a9c8a49d1eb49bc949c3af26080))

## [0.22.6](https://github.com/uploadcare/blocks/compare/v0.22.5...v0.22.6) (2023-05-26)

### Bug Fixes

- **cloud-editor:** init editor on initCallback instead of connectedCallback to prevent cases when editor init is going before the block init ([#467](https://github.com/uploadcare/blocks/issues/467)) ([f6d92fd](https://github.com/uploadcare/blocks/commit/f6d92fda5fc3c495111526b97f283b63a5cd3117))

## [0.22.5](https://github.com/uploadcare/blocks/compare/v0.22.4...v0.22.5) (2023-05-26)

### Bug Fixes

- do not use host-context unsupported in firefox and safari ([7ab7a98](https://github.com/uploadcare/blocks/commit/7ab7a985e17d6f3becff5c67c0ae7bb3e5bdb8ae))

## [0.22.4](https://github.com/uploadcare/blocks/compare/v0.22.3...v0.22.4) (2023-05-23)

### Bug Fixes

- **file-item:** do not validate local files if no mime type provided (this is the case for drag'n'dropped HEICs) ([e47497e](https://github.com/uploadcare/blocks/commit/e47497e3cfa72a415c24d9d28362b6a0b3c50738))
- **file-item:** validate file extensions along with the mime types ([b89ea0e](https://github.com/uploadcare/blocks/commit/b89ea0ed7ce81ab0f0f6071934f8fb3d4af71c0c))

## [0.22.3](https://github.com/uploadcare/blocks/compare/v0.22.2...v0.22.3) (2023-05-19)

### Features

- **external-source**: configurable social base url ([0cd7f94](https://github.com/uploadcare/blocks/commit/0cd7f94f1eef24b3ce0e346eb1ed5773e82c090e))

### Bug Fixes

- **drop-area:** fix detection of the active dropzone ([97dbb32](https://github.com/uploadcare/blocks/commit/97dbb3272a36e4ae97441a044ac5c260c2018829))
- **drop-area:** prevent flickering on file being dragged before init ([72b76a7](https://github.com/uploadcare/blocks/commit/72b76a7959881613866850f4cf56758624b93741))
- **file-uploader-inline:** update missing `init$` usage that was leading to crash ([51a7b10](https://github.com/uploadcare/blocks/commit/51a7b109df66e4fe654c46078a03b24474589d71))

## [0.22.2](https://github.com/uploadcare/blocks/compare/v0.22.1...v0.22.2) (2023-05-17)

### Bug Fixes

- add empty export to the blocks-browser bundle to fix working under isolatedModules ([#451](https://github.com/uploadcare/blocks/issues/451)) ([683fb2b](https://github.com/uploadcare/blocks/commit/683fb2b359d96550eee1c6e0ccf8873278c207ea))
- **cloud-editor:** extend from ShadowWrapper ([3c518a5](https://github.com/uploadcare/blocks/commit/3c518a55c3006efc8dba9a8c7e6d0aec1ee1649b))
- **cloud-editor:** solution bundle ([89ad5af](https://github.com/uploadcare/blocks/commit/89ad5afd2be4291f5abf85f179ec2d044136e2ef))

## [0.22.1](https://github.com/uploadcare/blocks/compare/v0.22.0...v0.22.1) (2023-05-15)

### Bug Fixes

- **copyright:** hide whole `lr-copyright` block if it's disabled ([2550d20](https://github.com/uploadcare/blocks/commit/2550d2009d2bf8819e9b7c0d4d2f8bdd7665d9a6))
- get rid of `ctxOwner` flag due to it's buggy behaviour ([6c5f374](https://github.com/uploadcare/blocks/commit/6c5f37442cec5b23f0f532854e28948e81129c51))

# [0.22.0](https://github.com/uploadcare/blocks/compare/v0.21.7...v0.22.0) (2023-05-12)

### Bug Fixes

- **file-item:** error while rewoke thumb ([9dc73ff](https://github.com/uploadcare/blocks/commit/9dc73ff956c7ac39b2cfc2ee97c686e3c33847b1))
- **progress-bar-common:** ignore pointer events when not active ([e6ddbf6](https://github.com/uploadcare/blocks/commit/e6ddbf611f9cc418f414d7489564cadf56097df1))
- Don't show block re-registration warnings for the same block components

### Features

- Run upload requests in the queue ([ed9d6de](https://github.com/uploadcare/blocks/commit/ed9d6de5c098b9433c9a4ad4c6c8d48bb1617737))

## [0.21.7](https://github.com/uploadcare/blocks/compare/v0.21.6...v0.21.7) (2023-05-03)

### Bug Fixes

- bump @uploadcare/upload-client to fix issues with Buffer polyfilling by CDNs (esm.sh, skypack) ([#442](https://github.com/uploadcare/blocks/issues/442)) ([afd1d7d](https://github.com/uploadcare/blocks/commit/afd1d7dcd48005c77a4487057fcb4c96133098a9))

## [0.21.6](https://github.com/uploadcare/blocks/compare/v0.21.5...v0.21.6) (2023-04-28)

### Bug Fixes

- **file-uploader-inline:** add `flex: 1` css property to fill all available space inside flex column container ([#439](https://github.com/uploadcare/blocks/issues/439)) ([a781d20](https://github.com/uploadcare/blocks/commit/a781d20217a923b02cd58bc5b093379a5e3b21a4))
- **package.json:** add types to exports field ([#440](https://github.com/uploadcare/blocks/issues/440)) ([718f432](https://github.com/uploadcare/blocks/commit/718f43214105f2b15c36b8d8344c5b723115295c))

## [0.21.5](https://github.com/uploadcare/blocks/compare/v0.21.4...v0.21.5) (2023-04-27)

### Bug Fixes

- **file-uploader-inline:** set init context ([#437](https://github.com/uploadcare/blocks/issues/437)) ([81031a7](https://github.com/uploadcare/blocks/commit/81031a7212b17ffe588d8d4e829734c59055aec8))

## [0.21.4](https://github.com/uploadcare/blocks/compare/v0.21.3...v0.21.4) (2023-04-27)

### Bug Fixes

- **file-uploader-inline:** do not try to hide drop area because it's hides itself ([#435](https://github.com/uploadcare/blocks/issues/435)) ([4f11007](https://github.com/uploadcare/blocks/commit/4f110071ba8b7709fcf6fe0f8f727224d5d3763f))

## [0.21.3](https://github.com/uploadcare/blocks/compare/v0.21.2...v0.21.3) (2023-04-27)

### Bug Fixes

- **modal:** restore scroll lock on modal destroy ([#433](https://github.com/uploadcare/blocks/issues/433)) ([70fad11](https://github.com/uploadcare/blocks/commit/70fad116fe1845b1ff590e765748a770d4f8ee12))

## [0.21.2](https://github.com/uploadcare/blocks/compare/v0.21.1...v0.21.2) (2023-04-27)

### Bug Fixes

- **jsx:** add missing lr-file-uploader-inline tag ([#431](https://github.com/uploadcare/blocks/issues/431)) ([a15cc28](https://github.com/uploadcare/blocks/commit/a15cc286fa0f09fb21248d425a0223b31ad77154))

## [0.21.1](https://github.com/uploadcare/blocks/compare/v0.21.0...v0.21.1) (2023-04-25)

### Bug Fixes

- **activity-block:** reset current activity ([e72f15c](https://github.com/uploadcare/blocks/commit/e72f15cfdd49d439e95644999cb160b3629c1009))
- **activity-header:** button colors in the darkmode ([6c29b47](https://github.com/uploadcare/blocks/commit/6c29b47bc515783927b1421ecbac1d04a1bb3d74))
- **block:** update css data when block is connected to the DOM only ([23a99e2](https://github.com/uploadcare/blocks/commit/23a99e220706ddd7fa5cdd2a48332ec3cb649c45))
- **drop-area:** disable and hide drop area if local sources are not allowed ([cf6bc8a](https://github.com/uploadcare/blocks/commit/cf6bc8a3c5ec1cea4dfd405d7d80c8d678c43d09))
- **external-source:** reactive style updates ([bb6838b](https://github.com/uploadcare/blocks/commit/bb6838b2f057fcfa5336ee8be1eaae8eb01d6a3a))
- **message-box:** reduce background lightness in the darkmode ([221bd05](https://github.com/uploadcare/blocks/commit/221bd05e86c62d8a75f7eb4f802f7fbbf58eaef5))
- **shadow-wrapper:** prepend css-src style instead of append to make easier to override styles via `shadowStyles` ([7941e40](https://github.com/uploadcare/blocks/commit/7941e4077a0ad15fed4af5acf8229257eba971d0))
- **simple-btn:** safari icon fractional scaling ([4400acd](https://github.com/uploadcare/blocks/commit/4400acd75d500df16b7f6067416f596e074e0114))
- **solutions:** export LR from web bundles ([d5e718c](https://github.com/uploadcare/blocks/commit/d5e718c935b5d238fb5a642444c46565b890e874))
- **source-list:** update children when source list is empty ([75cbbd4](https://github.com/uploadcare/blocks/commit/75cbbd414bc7d5e95125da9a77e6515aaba2c8c3))
- stub package exports for SSR ([d528184](https://github.com/uploadcare/blocks/commit/d528184093366efef61468b3342fdce5a18327f5))
- **upload-list:** do not try to handle file collection update while being disconnected from DOM ([ef6f101](https://github.com/uploadcare/blocks/commit/ef6f101eede0c9fffe9be52f31a04b1521eefad6))

# [0.21.0](https://github.com/uploadcare/blocks/compare/v0.20.1...v0.21.0) (2023-04-19)

### Features

- add `--cfg-external-sources-preferred-types` option to configure preferred mime types for the external sources ([1d4e645](https://github.com/uploadcare/blocks/commit/1d4e64583e7ab58670f2f094f691ad54175749d7))

## [0.20.1](https://github.com/uploadcare/blocks/compare/v0.20.0...v0.20.1) (2023-04-11)

### Bug Fixes

- bundle stubbed jsx types to npm package ([#414](https://github.com/uploadcare/blocks/issues/414)) ([98de315](https://github.com/uploadcare/blocks/commit/98de3150181556b8ade97d948ae4aa345adae8ee))

# [0.20.0](https://github.com/uploadcare/blocks/compare/v0.19.0...v0.20.0) (2023-04-10)

### Bug Fixes

- **file-item:** make ui reactive to css data ([5d64a05](https://github.com/uploadcare/blocks/commit/5d64a05a3ba5beb1919b98e9c1009cae27b5e616))
- **simple-btn:** prevent dropzone flickering on initial render ([82d9c1d](https://github.com/uploadcare/blocks/commit/82d9c1d6af67f115e276775d751ead280d211740))
- **types:** add type stub for `lr-upload-ctx-provider` ([560502f](https://github.com/uploadcare/blocks/commit/560502f82adb8604d1d61958046533bc5ec4f362))
- **uploader-block:** add missing external source types to the UploaderBlock's `sourceTypes` static property ([0a7c2fc](https://github.com/uploadcare/blocks/commit/0a7c2fcc573943a85dc875d51dfa79302ccc0ea0))

### Features

- add `--cfg-remove-copyright` option ([e128953](https://github.com/uploadcare/blocks/commit/e128953bf042b52cf5727f73f7321f4b23f6c60e))
- **block:** add method `updateCtxCssData` to update css data for all the blocks in the context ([5a89749](https://github.com/uploadcare/blocks/commit/5a8974972de401ca35873fb4f44b6e12768520f1))

# [0.19.0](https://github.com/uploadcare/blocks/compare/v0.18.1...v0.19.0) (2023-03-10)

### Bug Fixes

- **cloud-editor:** refetch image on container resize ([67ea66f](https://github.com/uploadcare/blocks/commit/67ea66f394cdbf43831e0410b9fc36e3406d1a4f))

### Features

- **cloud-editor:** use resize observer to wait for non-zero container size ([5686965](https://github.com/uploadcare/blocks/commit/56869653037dc0a6f7a140df34b5e0a56e347585))

## [0.18.1](https://github.com/uploadcare/blocks/compare/v0.18.0...v0.18.1) (2023-03-09)

### Bug Fixes

- **docs:** set cloud-editor examples body height ([#398](https://github.com/uploadcare/blocks/issues/398)) ([690760e](https://github.com/uploadcare/blocks/commit/690760e47903ee693b456c398dab4c165cec3fed))
- **lr-data-output:** create dynamic inputs container even if `input-required` is not defined ([#401](https://github.com/uploadcare/blocks/issues/401)) ([cdfce56](https://github.com/uploadcare/blocks/commit/cdfce567e888ecedec08d8c3d1dec13e07b7a671))

# [0.18.0](https://github.com/uploadcare/blocks/compare/v0.17.1...v0.18.0) (2023-02-17)

### Bug Fixes

- **modal:** backdrop color definition ([d8fcf51](https://github.com/uploadcare/blocks/commit/d8fcf51a93aef72250b1e3e0149f6557c34ad149))
- **modal:** do not manipulate `open` attr if dialog is supported ([4a286b9](https://github.com/uploadcare/blocks/commit/4a286b9e72236300a0f00d82ac53ce2db4619f81))

### Features

- **data-output:** add `input-required` attribute ([0fb1370](https://github.com/uploadcare/blocks/commit/0fb13702143dffd1f7cc4c6eeb4249cccba14721))
- **file-uploader-minimal:** include `lr-data-output` to the bundle ([a6e7802](https://github.com/uploadcare/blocks/commit/a6e78028e2369bf6e6c4ccf197f02a938b50a7a3))

## [0.17.1](https://github.com/uploadcare/blocks/compare/v0.17.0...v0.17.1) (2023-02-14)

### Bug Fixes

- **cloud-image-editor:** get rid of `change` event double initial calling ([#386](https://github.com/uploadcare/blocks/issues/386)) ([0cc0b00](https://github.com/uploadcare/blocks/commit/0cc0b0089c8f897c0ba3e4e951dd20188b21cf86))

# [0.17.0](https://github.com/uploadcare/blocks/compare/v0.16.1...v0.17.0) (2023-02-08)

### Bug Fixes

- **cloud-image-editor:** dispatch events with `bubble` and `composed` flags ([58733c4](https://github.com/uploadcare/blocks/commit/58733c49505d623dee0ac4aed53fb31df251f530))
- **cloud-image-editor:** fix extraction of `filter` operation with undefined value ([351b080](https://github.com/uploadcare/blocks/commit/351b0801a7356550ebfde5e2ee5b6b89851cdbf9))
- **cloud-image-editor:** pause render until container get non-zero size ([1e5a4a8](https://github.com/uploadcare/blocks/commit/1e5a4a8210f73c8a163ae363b6f7e7c993c83061))

### Features

- **cloud-image-editor:** Add `change` event ([1fff5fb](https://github.com/uploadcare/blocks/commit/1fff5fb95ca6bcd4661844fab956888e974531b6))

## [0.16.1](https://github.com/uploadcare/blocks/compare/v0.16.0...v0.16.1) (2023-02-06)

### Bug Fixes

- do not call init flow without user interaction ([#380](https://github.com/uploadcare/blocks/issues/380)) ([be100a5](https://github.com/uploadcare/blocks/commit/be100a5ef0bc254d62f89ad776482b07bda27d3f))
- **file-uploader-inline:** show back button ([#381](https://github.com/uploadcare/blocks/issues/381)) ([cb83ebe](https://github.com/uploadcare/blocks/commit/cb83ebe7b399cee80af00489b0b1a7c4b4aa77bb))

# [0.16.0](https://github.com/uploadcare/blocks/compare/v0.15.2...v0.16.0) (2023-02-03)

### Bug Fixes

- **file-uploader-inline:** hide close button ([4026508](https://github.com/uploadcare/blocks/commit/4026508265e9202dd10ecca9441e2ce7dd0d19e9))

### Features

- add `LR_DONE_FLOW` and `LR_INIT_FLOW` events ([b5828ad](https://github.com/uploadcare/blocks/commit/b5828ad1f9b0c9222afb48fb9f440aa303d31ddb))

## [0.15.2](https://github.com/uploadcare/blocks/compare/v0.15.1...v0.15.2) (2023-02-03)

### Bug Fixes

- **upload-list:** undefined files count in the header ([#376](https://github.com/uploadcare/blocks/issues/376)) ([c897986](https://github.com/uploadcare/blocks/commit/c8979864c6fe1a3ac1231caff1538263356ecf66))

## [0.15.1](https://github.com/uploadcare/blocks/compare/v0.15.0...v0.15.1) (2023-02-02)

### Bug Fixes

- **file-item:** dont show edit button if `--cfg-use-cloud-image-editor` flag is false ([#374](https://github.com/uploadcare/blocks/issues/374)) ([85d79bb](https://github.com/uploadcare/blocks/commit/85d79bb30cfbd751471e9186ec65cedd468fcd75))

# [0.15.0](https://github.com/uploadcare/blocks/compare/v0.14.3...v0.15.0) (2023-01-31)

We are excited to announce the launch of a brand-new design. This new design offers a more modern look and feels, making it easier and faster to use. We have also made several other UI improvements, such as improved navigation and a better overall user experience. We hope you enjoy the new design and experience.

### Breaking changes

If you haven't used custom templates, then there shouldn't be any breaking changes for you.

If you're using custom templates, you will need to update them to comply with the new version's default template.

- Content of `<lr-start-from />` component was modified
- `<lr-confirmation-dialog />` was removed

Here is the basic template for the `<lr-file-uploader-regular />` component:

```html
<lr-simple-btn></lr-simple-btn>

<lr-modal strokes block-body-scrolling>
  <lr-start-from>
    <lr-drop-area with-icon clickable></lr-drop-area>
    <lr-source-list wrap></lr-source-list>
    <lr-copyright></lr-copyright>
  </lr-start-from>
  <lr-upload-list></lr-upload-list>
  <lr-camera-source></lr-camera-source>
  <lr-url-source></lr-url-source>
  <lr-external-source></lr-external-source>
  <lr-cloud-image-editor></lr-cloud-image-editor>
</lr-modal>

<lr-message-box></lr-message-box>
<lr-progress-bar-common></lr-progress-bar-common>
```

### Bug Fixes

- **image-editor:** restore transformations state from the cdn url ([32b1858](https://github.com/uploadcare/blocks/commit/32b18580e780bd55b18cfa2f0d31aa4d0b5b8742))
- **shadow-wrapper:** hide container until css load ([ef9c552](https://github.com/uploadcare/blocks/commit/ef9c552c925a2c35689a4cdfe4bbd83e46e741db))
- specify image types for file input capture accept, fixes Firefox on Android ([99b5f4f](https://github.com/uploadcare/blocks/commit/99b5f4f20bad0573cc7ee81a567c52cd88ca3f7c))

### Features

- allow custom pluralizers ([62ecffb](https://github.com/uploadcare/blocks/commit/62ecffb387b2b912b061f43b3e9f7cd7903aee13))
- do not confirm upload list clearing ([c90c57a](https://github.com/uploadcare/blocks/commit/c90c57a9d1d4ab3e335fbd7a6486195d02b15de8))
- show `cloud editor` instead of `upload details` ([036be6c](https://github.com/uploadcare/blocks/commit/036be6c9ede40d81414c4aafa0a7c5ce244ced2f))
- **drop-area**: fullscreen mode
- **upload-list**: show upload errors inside file item

## [0.14.3](https://github.com/uploadcare/blocks/compare/v0.14.2...v0.14.3) (2022-12-20)

### Bug Fixes

- **data-output:** pass files or group URL to the hidden input ([160b08f](https://github.com/uploadcare/blocks/commit/160b08f174d605d3b499784c26793b3bebdfcf62))
- **events:** emit `LR_DATA_OUTPUT` on image edit ([fa30140](https://github.com/uploadcare/blocks/commit/fa30140c34dd6d46842d569c2654e7b330358bab))
- **events:** pass the whole file info object to to the `LR_CLOUD_MODIFICATION` event ([38440bd](https://github.com/uploadcare/blocks/commit/38440bdcd12ff64163662d0b4ae4ffa05f775d20))
- single source behaviour ([#343](https://github.com/uploadcare/blocks/issues/343)) ([d2929de](https://github.com/uploadcare/blocks/commit/d2929de53e4352fee815f95124796cd20f930838))

## [0.14.2](https://github.com/uploadcare/blocks/compare/v0.14.1...v0.14.2) (2022-11-22)

### Bug Fixes

- wrap `::backdrop` with `:is` to prevent ignoring from unsupported browsers ([#332](https://github.com/uploadcare/blocks/issues/332)) ([e3ef691](https://github.com/uploadcare/blocks/commit/e3ef6919f3154c7d0017df73c1a5ba63c0a0e996))

## [0.14.1](https://github.com/uploadcare/blocks/compare/v0.14.0...v0.14.1) (2022-10-26)

### Bug Fixes

- fix processing escaped css property values in Firefox

# [0.14.0](https://github.com/uploadcare/blocks/compare/v0.13.0...v0.14.0) (2022-10-26)

### Bug Fixes

- **external-source:** prevent iframe height overflow ([4fc669b](https://github.com/uploadcare/blocks/commit/4fc669b0d4f132c73a5cf533f01f06e2ac129bbc))
- **store:** set store to `auto` by default ([464a5ce](https://github.com/uploadcare/blocks/commit/464a5ce0273cdac55dc7f9457ce60d234dcc2c56))

### Features

- **Block:** use real window height instead of 100vh ([577981e](https://github.com/uploadcare/blocks/commit/577981e8ddeb5a55729dcae16a0f198a312c5f16))
- **camera-source:** show user media denied error to the user ([b4d167d](https://github.com/uploadcare/blocks/commit/b4d167d76fc80d213beb376c6e7a5b99685c4c30))
- **modal:** use native `dialog` element & close modal on outside click ([5ec02e0](https://github.com/uploadcare/blocks/commit/5ec02e0a948de90370e838f2ee107bc1a7ede8e1))

# [0.13.0](https://github.com/uploadcare/blocks/compare/v0.12.4...v0.13.0) (2022-10-17)

### Bug Fixes

- **drop-area:** open modal on files drop ([6c112a8](https://github.com/uploadcare/blocks/commit/6c112a88f02bbb5278e223f6f13f2d8b649c777d))

### Features

- **simple-button:** show drop area on files drag ([25fa023](https://github.com/uploadcare/blocks/commit/25fa023a997dca0c940bda55d3202cebf29db8b8))

## [0.12.4](https://github.com/uploadcare/blocks/compare/v0.12.3...v0.12.4) (2022-10-11)

### Bug Fixes

- **modal:** disable stroked backdrop by default ([970b590](https://github.com/uploadcare/blocks/commit/970b590a2b08e62713034d05082c81be9b699d11))

## [0.12.3](https://github.com/uploadcare/blocks/compare/v0.12.2...v0.12.3) (2022-10-10)

### Bug Fixes

- **register-blocks:** remove optional chaining usage ([935c8f3](https://github.com/uploadcare/blocks/commit/935c8f3e7d656d51b7b8fd0940c23d14c872491e))

## [0.12.2](https://github.com/uploadcare/blocks/compare/v0.12.1...v0.12.2) (2022-10-08)

### Bug Fixes

- **connect-blocks-from:** remove optional chaining usage ([f93ab07](https://github.com/uploadcare/blocks/commit/f93ab07cc376a1201735163bdfa100f6cba7203b))

## [0.12.1](https://github.com/uploadcare/blocks/compare/v0.12.0...v0.12.1) (2022-10-05)

### Bug Fixes

- **file-item:** cancel debounced thumb generation on element disconnect ([#294](https://github.com/uploadcare/blocks/issues/294)) ([7371335](https://github.com/uploadcare/blocks/commit/7371335b1df55a5b4fdd1ca3e4880986d7b159cf))

# [0.12.0](https://github.com/uploadcare/blocks/compare/v0.11.1...v0.12.0) (2022-10-03)

### Bug Fixes

- count blocks number in the registry and unobserve upload collection when there are no any registred blocks ([9134f9b](https://github.com/uploadcare/blocks/commit/9134f9b261f09d2090230bf7c082befe28af94e3))
- **file-uploader-minimal:** add missing translations ([#291](https://github.com/uploadcare/blocks/issues/291)) ([2ee8964](https://github.com/uploadcare/blocks/commit/2ee8964f62343d4460640e29cefa0ba74de24695))

### Features

- add export of `ShadowWrapper` ([6fedc7c](https://github.com/uploadcare/blocks/commit/6fedc7c6035d50171d06f1956a32de38b81becaa))

## [0.11.1](https://github.com/uploadcare/blocks/compare/v0.11.0...v0.11.1) (2022-09-28)

### Bug Fixes

- **file-item:** check file mime type before upload ([0ced1ef](https://github.com/uploadcare/blocks/commit/0ced1ef6b082b6bb3f2089f20dbe59de3db5f680))
- **file-item:** check for allowed mime types list length before match ([16cabec](https://github.com/uploadcare/blocks/commit/16cabec53d3cb5b8bde059b8ee739709118cd354))
- **file-item:** do not handle empty mime types ([3ce3e95](https://github.com/uploadcare/blocks/commit/3ce3e9575742936433eefb1cb7338544f7ae0d0e))
- **file-item:** skip `isImage` check for the external files before upload ([7f19457](https://github.com/uploadcare/blocks/commit/7f19457173e004e52882362cd3d75dd967f29fce))
- **uploader-block:** fix array destructuring mistake ([09d57f6](https://github.com/uploadcare/blocks/commit/09d57f664b6be4bb42a992486c26fbca248f9b0c))

# [0.11.0](https://github.com/uploadcare/blocks/compare/v0.10.3...v0.11.0) (2022-09-26)

### Bug Fixes

- **lr-image:** return data: and blob: sources as is ([e83518b](https://github.com/uploadcare/blocks/commit/e83518bfbbfd69bdf259ca0f5b8b3473cff5c7ae))
- **lr-image:** set provided custom `cdn-cname` when uuid attr passed ([ff04d93](https://github.com/uploadcare/blocks/commit/ff04d93ff8f4a9e71d8ee3fe8e54678e1316db73))
- svg image preview rendering in firefox ([1231951](https://github.com/uploadcare/blocks/commit/12319512296afc2576326094fad3a7a59b3cdcca))

### Features

- **lr-image:** don't proxify already uploaded images ([4d0dc0d](https://github.com/uploadcare/blocks/commit/4d0dc0da5d0a4e4a919911791f845913a23377d8))

## [0.10.3](https://github.com/uploadcare/blocks/compare/v0.10.2...v0.10.3) (2022-09-23)

### Bug Fixes

- **file-item:** uploading from external url (typo) ([#281](https://github.com/uploadcare/blocks/issues/281)) ([ed5c741](https://github.com/uploadcare/blocks/commit/ed5c741e0dc1f37fa6a58b073cd3df9e05a3168c))
- unobserve upload collection on destroy ([#282](https://github.com/uploadcare/blocks/issues/282)) ([2c871e1](https://github.com/uploadcare/blocks/commit/2c871e1a1f77d82731b48374cef2713be90f3d64))

## [0.10.2](https://github.com/uploadcare/blocks/compare/v0.10.1...v0.10.2) (2022-09-22)

### Bug Fixes

- **external-source:** disable `done` button when no files selected ([#278](https://github.com/uploadcare/blocks/issues/278)) ([7ae584f](https://github.com/uploadcare/blocks/commit/7ae584fc5dc1cab7e9718ea0ae2f4340b331a2dd))

## [0.10.1](https://github.com/uploadcare/blocks/compare/v0.10.0...v0.10.1) (2022-09-20)

### Bug Fixes

- **file-item:** prevent flickering ([d04ec9d](https://github.com/uploadcare/blocks/commit/d04ec9d8ddf893410025adb49c262c24399d7fa3))
- **file-item:** regenerate thumb on image edit ([15e567d](https://github.com/uploadcare/blocks/commit/15e567dddd5af05ffc7b3d76f02db25d31067516))
- rework history ([f7e39f9](https://github.com/uploadcare/blocks/commit/f7e39f9234f384f40f50cb211268f319d3a5b3d5))
- **upload-list:** do not close modal automatically if `--cfg-confirm-upload` enabled ([68f3e93](https://github.com/uploadcare/blocks/commit/68f3e931ffd37a37b2622653fb3a65ee78530a48))

# [0.10.0](https://github.com/uploadcare/blocks/compare/v0.9.4...v0.10.0) (2022-09-19)

### Bug Fixes

- **file-item:** calculate state in the single place ([8eb5f6e](https://github.com/uploadcare/blocks/commit/8eb5f6e1b53b4c1e03d39a7c8bda792110a11dc6))
- **file-item:** proper request abort, restore state on new entry, optimize thumb generation ([60038f2](https://github.com/uploadcare/blocks/commit/60038f2afabe37723f263cda506ffc846b13118f))
- **upload-list:** enable `Upload` button if any file isn't started uploading ([9b980c4](https://github.com/uploadcare/blocks/commit/9b980c4600b7dbedf73a31c6f4294a63cea216ee))
- **uploader-block:** do not history back if no any files in the collection ([34bbb7e](https://github.com/uploadcare/blocks/commit/34bbb7eac0e3ccfd1ec20bb768fc0649897e733c))

### Features

- **typed-collection:** check type with instanceof ([409feec](https://github.com/uploadcare/blocks/commit/409feec27c775ae235270cb47fec0d735712da4f))
- **typed-collection:** notify subscribers about added and removed items ([624c282](https://github.com/uploadcare/blocks/commit/624c282839ecf7c621e01aafd2107f9f10d3cbf4))

## [0.9.4](https://github.com/uploadcare/blocks/compare/v0.9.3...v0.9.4) (2022-09-13)

### Bug Fixes

- do not use `structuredClone` due to unsupport in safari <= 15.3 ([#257](https://github.com/uploadcare/blocks/issues/257)) ([8708b08](https://github.com/uploadcare/blocks/commit/8708b08483b220e69d8a58be3b9ebad68664fc75))
- **message-box:** specify text-align for message ([#254](https://github.com/uploadcare/blocks/issues/254)) ([2561eb6](https://github.com/uploadcare/blocks/commit/2561eb6b2441082826082ac7353892dd1b81130d))

## [0.9.3](https://github.com/uploadcare/blocks/compare/v0.9.2...v0.9.3) (2022-09-09)

### Bug Fixes

- abort uploading on item remove ([c53d730](https://github.com/uploadcare/blocks/commit/c53d73008297c6645d997fa869ecf8ac85317495))
- **core:** deep clone shared initial state before use it ([f48e7f3](https://github.com/uploadcare/blocks/commit/f48e7f3e61722eb5b4d3206565d7d8c9e49971a0))
- **file-uploader-minimal:** add missing icons ([91f08b4](https://github.com/uploadcare/blocks/commit/91f08b40a79717a490a961c46a8e145fc6526c97))
- **file-uploader-minimal:** do not show empty list ([15c1fb4](https://github.com/uploadcare/blocks/commit/15c1fb4c9396725519100b3a4fb23feb4f034c1a))
- **upload-list:** do not call upload done callback on empty list ([522a8cb](https://github.com/uploadcare/blocks/commit/522a8cb682f30a7a095872cb7cb490a69a49aef7))
- **upload-list:** wrong scrollable content height on safari 15.3 ([#248](https://github.com/uploadcare/blocks/issues/248)) ([60573d8](https://github.com/uploadcare/blocks/commit/60573d8e6c452e7cb295c0b4cf019c181fe42eb5))

## [0.9.2](https://github.com/uploadcare/blocks/compare/v0.9.1...v0.9.2) (2022-09-02)

## [0.9.1](https://github.com/uploadcare/uc-blocks/compare/v0.9.0...v0.9.1) (2022-08-31)

### Bug Fixes

- DropArea > prevent activity change on empty list ([f65806e](https://github.com/uploadcare/uc-blocks/commit/f65806ed40ce25ec200ee0dfc85bf9ce709b6c9b))

# [0.9.0](https://github.com/uploadcare/uc-blocks/compare/v0.8.1...v0.9.0) (2022-08-31)

### Bug Fixes

- gitignore exception fro types ([98acdeb](https://github.com/uploadcare/uc-blocks/commit/98acdeb7777277e910c27c947e7b016f26d795b4))
- types ([8fdcd59](https://github.com/uploadcare/uc-blocks/commit/8fdcd591b4a103f53d8cf04f802693545b178e67))

## [0.8.1](https://github.com/uploadcare/uc-blocks/compare/v0.8.0...v0.8.1) (2022-08-26)

### Bug Fixes

- **cloud-image-editor:** errors while edit image multiple times ([#232](https://github.com/uploadcare/uc-blocks/issues/232)) ([743220d](https://github.com/uploadcare/uc-blocks/commit/743220d08ec5da0687a6c85438d615cf0ab5a7ee))
- ctx-owner rendering issue (React) ([0365765](https://github.com/uploadcare/uc-blocks/commit/0365765caf861f02112149ef30c338c274bae248))

# [0.8.0](https://github.com/uploadcare/uc-blocks/compare/v0.7.2...v0.8.0) (2022-08-23)

### Bug Fixes

- #BLOCKS-130 ([165d9d2](https://github.com/uploadcare/uc-blocks/commit/165d9d28dbc04c199962d0eec30dd4233fe838e7)), closes [#BLOCKS-130](https://github.com/uploadcare/uc-blocks/issues/BLOCKS-130)
- data output call bound to upload state and uploaded items removal + lr-img fix ([863fe99](https://github.com/uploadcare/uc-blocks/commit/863fe9956a605e3f5d88e674802e76160293f759))
- double slash bug with --cfg-cdn-cname trailing slash ([6a121c9](https://github.com/uploadcare/uc-blocks/commit/6a121c9101b7d0bcc30c5d70c5b05cadeda3061a))
- merge issues ([ba48502](https://github.com/uploadcare/uc-blocks/commit/ba48502a9d44a7ed32ba79b47abc6632ca38d07e))
- modal layout in Safari ([52bbc4a](https://github.com/uploadcare/uc-blocks/commit/52bbc4aa8b5b1ff8d63b4ecbcc9237112a0adb1e))
- TS error ([f0babf1](https://github.com/uploadcare/uc-blocks/commit/f0babf16e99556e58b1cd647b189b87c4fa64dcb))

### Features

- add clickable attribute to DropArea ([d486788](https://github.com/uploadcare/uc-blocks/commit/d48678897b589893ddd4d706e85f2afbd38ee2b6))
- connectBlocksFrom added ([4c80a97](https://github.com/uploadcare/uc-blocks/commit/4c80a978dcc21db34b19077d63d7d3f14f45cdd9))
- custom base upload URL support ([6d03fd1](https://github.com/uploadcare/uc-blocks/commit/6d03fd1624263cc61e3de73277d6ee9bc009637e))
- drag-n-drop page img ([0ec0e69](https://github.com/uploadcare/uc-blocks/commit/0ec0e69a14d4682b0cc72d001affc5f6873c1c78))
- lr-drop-area is-image validation support ([3bc8ae5](https://github.com/uploadcare/uc-blocks/commit/3bc8ae5343ba90e5ee585ce194e7a4a296f8d68f))
- workflow evens ([7709a1d](https://github.com/uploadcare/uc-blocks/commit/7709a1df16892b9194b0d2386fe195d4586e0cab))

## [0.7.2](https://github.com/uploadcare/uc-blocks/compare/v0.7.1...v0.7.2) (2022-08-11)

## [0.7.1](https://github.com/uploadcare/uc-blocks/compare/v0.7.0...v0.7.1) (2022-08-04)

### Bug Fixes

- **file-uploader-minimal:** ensure current activity is always present ([33ee804](https://github.com/uploadcare/uc-blocks/commit/33ee80486b689d414bc8c08bf30c0aa09f33d27b))

# [0.7.0](https://github.com/uploadcare/uc-blocks/compare/v0.6.0...v0.7.0) (2022-08-04)

### Bug Fixes

- **cloud-editor:** create own context ([db97b19](https://github.com/uploadcare/uc-blocks/commit/db97b1981bfb08bcbb5851c9fac068d79edcf41d))
- **data-output:** do not set value property ([88c5deb](https://github.com/uploadcare/uc-blocks/commit/88c5debccc5f23915baf4446e3322b9c50a20711))
- **file-item:** call IntersectionObserver.unobserve in the right places ([3216ad7](https://github.com/uploadcare/uc-blocks/commit/3216ad767a2198a00ea9cdbb5f308b3b5c6c4275))
- move TypedCollection and TypedData from symbiote to our repo ([#211](https://github.com/uploadcare/uc-blocks/issues/211)) ([eb99ce7](https://github.com/uploadcare/uc-blocks/commit/eb99ce7186d9e2f4e53921bcd1fc0c07eb5a447a))
- specify side-effects for .css files ([#210](https://github.com/uploadcare/uc-blocks/issues/210)) ([30d7e51](https://github.com/uploadcare/uc-blocks/commit/30d7e51de5c91ffcc5f68d4326c2b9f99910f19f))
- use zero specific css selectors for common classes to allow user to override styles ([#209](https://github.com/uploadcare/uc-blocks/issues/209)) ([959931b](https://github.com/uploadcare/uc-blocks/commit/959931bf7cd15c3a15d992d0a8e6c9c24d33aa5f))
- volume range behavior ([aede13b](https://github.com/uploadcare/uc-blocks/commit/aede13b1fbacbcb25ce1b5dd75a17f9d7540cce6))

### Features

- add `--cfg-user-agent-integration` option ([75eebf0](https://github.com/uploadcare/uc-blocks/commit/75eebf018faec79d2a5c7d94f059136456de1c4f))
- lr-video stage 1 ([626d5b6](https://github.com/uploadcare/uc-blocks/commit/626d5b66e1c685ee69247666fdb49289d827d939))

# [0.6.0](https://github.com/uploadcare/uc-blocks/compare/v0.5.2...v0.6.0) (2022-07-14)

### Bug Fixes

- blocks test refs ([3f72272](https://github.com/uploadcare/uc-blocks/commit/3f7227263a7e94743478bcd2d00d3650cb6bcc2c))
- irRef in CameraSource ref ([881fbb8](https://github.com/uploadcare/uc-blocks/commit/881fbb8110adb74111a5855ecade731ebcda12be))

### Features

- **img:** proxify image load and error events ([#202](https://github.com/uploadcare/uc-blocks/issues/202)) ([7350c97](https://github.com/uploadcare/uc-blocks/commit/7350c9775b3cd04f6e3689360955a3eb0be8d837))

## [0.5.2](https://github.com/uploadcare/uc-blocks/compare/v0.5.1...v0.5.2) (2022-07-07)

### Bug Fixes

- camera label ([287700f](https://github.com/uploadcare/uc-blocks/commit/287700f26ddb6fe98e55f8edbf1423d0e1e364e4))
- empty camera labels return on some platforms ([d66b471](https://github.com/uploadcare/uc-blocks/commit/d66b471feb6be7f1dcc67d687cabfe2ce758becc))

## [0.5.1](https://github.com/uploadcare/uc-blocks/compare/v0.5.0...v0.5.1) (2022-07-06)

### Bug Fixes

- camera-source with symbiote updated ([5d136e4](https://github.com/uploadcare/uc-blocks/commit/5d136e481258edc4bca270d03b33422195a55dda))

# [0.5.0](https://github.com/uploadcare/uc-blocks/compare/v0.4.1...v0.5.0) (2022-07-06)

### Bug Fixes

- TS fix ([ed631f8](https://github.com/uploadcare/uc-blocks/commit/ed631f8980ef184d38819b56de23169f81fd0f48))

### Features

- camera selector ([18dbd99](https://github.com/uploadcare/uc-blocks/commit/18dbd993460923f2802993079d040179dc52d48e))
- lr-select + camera selector WIP ([aad6e9b](https://github.com/uploadcare/uc-blocks/commit/aad6e9bcd059493bf75b9f3bf5c94a7b30af9499))

## [0.4.1](https://github.com/uploadcare/uc-blocks/compare/v0.4.0...v0.4.1) (2022-06-29)

### Bug Fixes

- add missing FileUploaderInline export ([1fa0888](https://github.com/uploadcare/uc-blocks/commit/1fa088891eb6b102558b8891552cfbb4f467c1a1))
- bump upload-client version ([5b1df67](https://github.com/uploadcare/uc-blocks/commit/5b1df679920bee22814539a2faf1d3f0706ac358))
- **cloud-editor:** do not initialize --cfg-cdn-cname with empty string ([07a770b](https://github.com/uploadcare/uc-blocks/commit/07a770b3622b9e05e9963f71774bbc3510f1312b))

# [0.4.0](https://github.com/uploadcare/uc-blocks/compare/v0.3.0...v0.4.0) (2022-06-22)

### Bug Fixes

- camera settings not depends to activity ([7cd54c0](https://github.com/uploadcare/uc-blocks/commit/7cd54c061f9348b43153bb917ae8f2ebec116b34))
- symbiote path ([1e06783](https://github.com/uploadcare/uc-blocks/commit/1e06783f1ae0d99e64d3f1489e015992da03cfe6))
- ts error ([55aae04](https://github.com/uploadcare/uc-blocks/commit/55aae04393456549199cef1074a17f53a8346048))
- ts error ([46fbfcf](https://github.com/uploadcare/uc-blocks/commit/46fbfcf61ac724b9311a05bfbdcbfdca756398c6))
- ts errors in node_modules =( ([a0ce5b5](https://github.com/uploadcare/uc-blocks/commit/a0ce5b5b67d45ddbcc26a7791e3e797db9c77848))

### Features

- add `setUploadMetadata` public api method ([#172](https://github.com/uploadcare/uc-blocks/issues/172)) ([d3b7301](https://github.com/uploadcare/uc-blocks/commit/d3b73011290ed274a6cc5a7945abc0e1d78891ca))
- static docs generation ([d8cf4e1](https://github.com/uploadcare/uc-blocks/commit/d8cf4e150dd6bc13c1111f54e935b3a1b7ad43e5))
- test:light ([29106de](https://github.com/uploadcare/uc-blocks/commit/29106de13aad3b2fcf7151d10153b673115af64d))

# [0.3.0](https://github.com/uploadcare/uc-blocks/compare/v0.2.0...v0.3.0) (2022-06-15)

### Bug Fixes

- add `type=button` to all the buttons to prevent form submit ([e681ca5](https://github.com/uploadcare/uc-blocks/commit/e681ca5e244e4a484cedca5941974ad16696f5e2))
- **FileItem:** error icon ([094eb7b](https://github.com/uploadcare/uc-blocks/commit/094eb7bb8a8a1bb9f8ff2c7a6cb5be6f628c0b92))
- TS fix ([72f6a91](https://github.com/uploadcare/uc-blocks/commit/72f6a915e820446f3affd137d428712c2a47fcfb))
- **upload-details:** handle not-uploaded images and clear canvase before preview render ([d522818](https://github.com/uploadcare/uc-blocks/commit/d522818133bd175b7c3767635923d8cc2cf87fbe))
- **upload-details:** render preview image with `format/auto` and `preview` operations ([7c30d29](https://github.com/uploadcare/uc-blocks/commit/7c30d290fa08fc62826109a880ea916ebd5e6500))
- **upload-details:** show/hide `cloud edit` button properly ([b2efe40](https://github.com/uploadcare/uc-blocks/commit/b2efe4044c9f90351146bc6040237901204d873f))

### Features

- add `--cfg-cdn-cname` option ([#154](https://github.com/uploadcare/uc-blocks/pull/154))
- add `--cfg-preview-proxy` option state ([#157](https://github.com/uploadcare/uc-blocks/pull/157))
- add `--cfg-secure-expire` and `--cfg-secure-signature` ([#156](https://github.com/uploadcare/uc-blocks/pull/156))
- **cloud-image-editor:** add separate config for the solution ([f6b1726](https://github.com/uploadcare/uc-blocks/commit/f6b172602f8b260e0c018ffc95457df64acff6e1))
- **Img:** secure delivery support ([a14baa1](https://github.com/uploadcare/uc-blocks/commit/a14baa13a6ec0512825af6b2409f9ab2d1b818f5))
- optional grouping output support ([3f9b23c](https://github.com/uploadcare/uc-blocks/commit/3f9b23cec283fe221bb790672876e4d3724ee97c))
- passthrough upload-client options ([80c2226](https://github.com/uploadcare/uc-blocks/commit/80c222679ad5a0f0fb7f8adb7cef057bbbf4b19b))

# [0.2.0](https://github.com/uploadcare/uc-blocks/compare/v0.1.3...v0.2.0) (2022-05-17)

### Bug Fixes

- app-shell backdrop fallback for Firefox ([f18ecc5](https://github.com/uploadcare/uc-blocks/commit/f18ecc5d838b996085bcfea839b40627c01a45ee))
- minor bugs ([#149](https://github.com/uploadcare/uc-blocks/issues/149)) ([d88aff7](https://github.com/uploadcare/uc-blocks/commit/d88aff71a100379af319ef6a2601720e489342d4))
- pass `cdnUrlModifiers` to the output ([#125](https://github.com/uploadcare/uc-blocks/issues/125)) ([c521c72](https://github.com/uploadcare/uc-blocks/commit/c521c72c9f2b1928191ea32b2296011bafeae78c))

### Features

- `current-activity` attr ([#124](https://github.com/uploadcare/uc-blocks/issues/124)) ([134adeb](https://github.com/uploadcare/uc-blocks/commit/134adeb1c94a8ecefbe575ca4915bbc22ff9ef92))
- `remote-tab-session-key` ([#127](https://github.com/uploadcare/uc-blocks/issues/127)) ([66ca253](https://github.com/uploadcare/uc-blocks/commit/66ca253d4045f59ef4023e48730d46ab78677e93))
- file-max-size ([#152](https://github.com/uploadcare/uc-blocks/issues/152)) ([e626a82](https://github.com/uploadcare/uc-blocks/commit/e626a82d435680ac25ce065ffe4dc51a0db89b2f))
- implement minmax files count limitation ([#143](https://github.com/uploadcare/uc-blocks/issues/143)) ([dd46f04](https://github.com/uploadcare/uc-blocks/commit/dd46f0446d79795be7075dfaed9a6a977d91b2ec))
- make `--cfg-img-only` option work ([#151](https://github.com/uploadcare/uc-blocks/issues/151)) ([fd3ff99](https://github.com/uploadcare/uc-blocks/commit/fd3ff9941e94ab43bfa24d00e4140e58f04b8dbf))
- uc-img src ([dc4bae3](https://github.com/uploadcare/uc-blocks/commit/dc4bae373a496b2faec0cd742b1f4788796b5a1b))

## [0.1.3](https://github.com/uploadcare/uc-blocks/compare/v0.1.2...v0.1.3) (2022-04-27)

### Bug Fixes

- uc-image breakpoint duplicates ([8d3b542](https://github.com/uploadcare/uc-blocks/commit/8d3b542bc870ee1a84c61f2a9be47e77b92d8d96))

## [0.1.2](https://github.com/uploadcare/uc-blocks/compare/v0.1.1...v0.1.2) (2022-04-25)

## [0.1.1](https://github.com/uploadcare/uc-blocks/compare/v0.1.0...v0.1.1) (2022-04-21)

# [0.1.0](https://github.com/uploadcare/uc-blocks/compare/v0.0.6...v0.1.0) (2022-04-21)

### Bug Fixes

- blocks page navigation ([aba948f](https://github.com/uploadcare/uc-blocks/commit/aba948f690b72645d180be7160caaea9582fd80d))
- **camera-source:** l10n fix ([ddc1abd](https://github.com/uploadcare/uc-blocks/commit/ddc1abd6ecf7103206c3224c0d92568f15e304d1))
- closing slash for uc-img src + common test updates ([7dc5e17](https://github.com/uploadcare/uc-blocks/commit/7dc5e17cfa12347c615a6fc1cee4e815aa71cd78))
- closing slash for uc-img src 2 ([50d3ce0](https://github.com/uploadcare/uc-blocks/commit/50d3ce0584d1e4336ed2b4a7348b32939b9e538d))
- cloud editor styles and behaviour ([5a3fcec](https://github.com/uploadcare/uc-blocks/commit/5a3fcecbc70bd87de0654318af128d82f093ce8d))
- **cloud-image-editor:** retry network button ([b2ff5e0](https://github.com/uploadcare/uc-blocks/commit/b2ff5e07b71ff8ec58f85a762c786786a0fb9bd9))
- edit button visibility ([c45c60f](https://github.com/uploadcare/uc-blocks/commit/c45c60f32bacbc23fc7d276cd029d4a0c22f4804))
- excess render calls for the FileItem on "Add more" ([655747a](https://github.com/uploadcare/uc-blocks/commit/655747a92fa102c91ba9a831a55ff914c0e0a58f))
- external source type ([832d269](https://github.com/uploadcare/uc-blocks/commit/832d2692c3110509670d9e9bd52698ca2c458e00))
- live-html indents ([137d6a8](https://github.com/uploadcare/uc-blocks/commit/137d6a8d9e94bd4a3bca4170326ee337442ec119))
- regular uploader demo ([149d0c2](https://github.com/uploadcare/uc-blocks/commit/149d0c2031de3eac89a6aa2e461add1ba80fc11c))
- single source flow + minimal case activity ([ff8c335](https://github.com/uploadcare/uc-blocks/commit/ff8c33542cc0ac732ffeef56317d66b1f360e4d6))
- styles for modal sizes & content scrolls ([892e3ea](https://github.com/uploadcare/uc-blocks/commit/892e3eaa7a6ab88f64496443b5bcaf5c99447105))

### Features

- app-shell (test) ([be01d8a](https://github.com/uploadcare/uc-blocks/commit/be01d8acbe04578acc65bf7d31620ecef6461989))
- app-shell (test) ([0fd91bc](https://github.com/uploadcare/uc-blocks/commit/0fd91bcc2426c43a4062d5085fc7fdec4628e533))
- github contribution templates and conditions added ([7c75ead](https://github.com/uploadcare/uc-blocks/commit/7c75eadfa3f376ad5d6354bd6a7288a543878e0f))
- single source flow handle ([a899c15](https://github.com/uploadcare/uc-blocks/commit/a899c15749b5de41dd7a790fa7fd53d90376d9d7))
- single source handle ([ad7b8ce](https://github.com/uploadcare/uc-blocks/commit/ad7b8ce41ba0bcb58a415a26f7bb3f91ccb23761))
- single source handle WIP ([5f19625](https://github.com/uploadcare/uc-blocks/commit/5f19625d962265d83e7d574ee300b809daef4a86))
- uc-image solution ([340349a](https://github.com/uploadcare/uc-blocks/commit/340349a52742c56d63e82df75dfb03f39ecd2db5))
- uc-live-html - remove excess tree indents for innerHTML ([920cbd4](https://github.com/uploadcare/uc-blocks/commit/920cbd45ba36014fae71e64c7812dcc0c15d20e1))
