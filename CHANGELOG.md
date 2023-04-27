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
