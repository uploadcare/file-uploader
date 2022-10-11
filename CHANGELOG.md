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
