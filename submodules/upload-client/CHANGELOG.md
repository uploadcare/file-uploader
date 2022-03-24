# [3.0.0](https://github.com/uploadcare/uploadcare-upload-client/compare/v2.2.0...v3.0.0) (2022-02-24)


### Bug Fixes

* remove `exports` field at package.json ([#360](https://github.com/uploadcare/uploadcare-upload-client/issues/360)) ([1e37542](https://github.com/uploadcare/uploadcare-upload-client/commit/1e37542108258d49159a45ed80d6dc27799ad22a))


* fix!: split progress info to computable and unknown ones (#363) ([7638284](https://github.com/uploadcare/uploadcare-upload-client/commit/7638284a8a9b14e0b10403c0496c29159d9c3b39)), closes [#363](https://github.com/uploadcare/uploadcare-upload-client/issues/363)


### BREAKING CHANGES

* `value` property of progress info can be `undefined` instead of `NaN` in case of uploading from URL. See `isComputable` flag to detect whether `value` is available.



# [2.2.0](https://github.com/uploadcare/uploadcare-upload-client/compare/v2.1.0...v2.2.0) (2021-12-22)


### Features

* export UploadcareClientError class ([#355](https://github.com/uploadcare/uploadcare-upload-client/issues/355)) ([848eadf](https://github.com/uploadcare/uploadcare-upload-client/commit/848eadfcdb021fd506a6d6ee2f7f6e2208804de4))



# [2.1.0](https://github.com/uploadcare/uploadcare-upload-client/compare/v2.0.0...v2.1.0) (2021-12-07)


### Features

* export `UploadcareFile` and `UploadcareGroup` types ([#353](https://github.com/uploadcare/uploadcare-upload-client/issues/353)) ([29d1547](https://github.com/uploadcare/uploadcare-upload-client/commit/29d154798865f627cabd54982b213e24ac2f27d5))



# [2.0.0](https://github.com/uploadcare/uploadcare-upload-client/compare/v1.1.5...v2.0.0) (2021-11-15)


### Features

* feat!: add cjs and esm support (#283) ([081f27e](https://github.com/uploadcare/uploadcare-upload-client/commit/081f27ef6022e6bdc605bc25e18313786c3f65d0)), closes [#283](https://github.com/uploadcare/uploadcare-upload-client/issues/283)
* feat!: replace CancelController with native AbortController (#282) ([020e1ae](https://github.com/uploadcare/uploadcare-upload-client/commit/020e1aeca1507979dbd123711a600e6692ca911f)), closes [#282](https://github.com/uploadcare/uploadcare-upload-client/issues/282)
* add mimeType to UploadcareFile type ([33b6c58](https://github.com/uploadcare/uploadcare-upload-client/commit/33b6c586f291569ff8eabbd488d8f61bde66de4b))
* export high-level upload methods ([1354018](https://github.com/uploadcare/uploadcare-upload-client/commit/1354018ce350895f638ba7be6ade6223193df407))
* handle server error codes ([948c9d1](https://github.com/uploadcare/uploadcare-upload-client/commit/948c9d140685aa2d0325904220ff42c262aaae79))
* add option `userAgent` to pass custom user agent string or function ([d74fefb](https://github.com/uploadcare/uploadcare-upload-client/commit/d74fefb18168fbfec8aa3daf2707da3305846879))


### BREAKING CHANGES

* remove default export because webpack can't handle it without bugs
* replace `cancel` key with `signal` in all cancelable methods
* property `response` of `UploadClientError` now contains the whole response object (`{ error: {...}}`)



## [1.1.5](https://github.com/uploadcare/uploadcare-upload-client/compare/v1.1.4...v1.1.5) (2021-06-28)


### Bug Fixes

* pass missing props from `uploadFile` down to the upload methods ([#339](https://github.com/uploadcare/uploadcare-upload-client/issues/339)) ([e16dc73](https://github.com/uploadcare/uploadcare-upload-client/commit/e16dc732613614686048f15fb1dcc8f400663e4d))



## [1.1.4](https://github.com/uploadcare/uploadcare-upload-client/compare/v1.1.3...v1.1.4) (2021-06-11)


### Bug Fixes

* checkForUrlDuplicates & saveUrlForRecurrentUploads parameters passed into common uploadFile method ([201ee07](https://github.com/uploadcare/uploadcare-upload-client/commit/201ee07587f1b2143e7685e049d031ec94a1fa3d))



## [1.1.3](https://github.com/uploadcare/uploadcare-upload-client/compare/v1.1.2...v1.1.3) (2021-03-17)


### Bug Fixes

* **react-native:** prevent app crashes while multipart uploading ([#308](https://github.com/uploadcare/uploadcare-upload-client/issues/308)) ([5d305e6](https://github.com/uploadcare/uploadcare-upload-client/commit/5d305e68b8026f729cb3a29d29f386fd882b4b5d))
* **react-native:** support direct uploads through FormData ([#307](https://github.com/uploadcare/uploadcare-upload-client/issues/307)) ([428b039](https://github.com/uploadcare/uploadcare-upload-client/commit/428b039374c98ae689c6c40b3e91d25b11481849))



## [1.1.2](https://github.com/uploadcare/uploadcare-upload-client/compare/v1.1.1...v1.1.2) (2020-04-20)


### Bug Fixes

* **multipart:** implement retry for part uploading ([#253](https://github.com/uploadcare/uploadcare-upload-client/issues/253)) ([e2330bb](https://github.com/uploadcare/uploadcare-upload-client/commit/e2330bb37ea75b2d82c3258696b5d18cf719eae5))
* **multipart:** add is ready pool for mulipart upload ([#254](https://github.com/uploadcare/uploadcare-upload-client/issues/254)) ([fe7ca2a](https://github.com/uploadcare/uploadcare-upload-client/commit/fe7ca2a0bbee7b24de2a792669ec33691cb2fd0c))
* **multipart:** implement multipart progress for node ([#252](https://github.com/uploadcare/uploadcare-upload-client/issues/252)) ([b60eb83](https://github.com/uploadcare/uploadcare-upload-client/commit/b60eb831ff966a4c6a80f2ee9d72ce3b76659d56))
* **multipart:** use browser contentType if option is not passed ([#251](https://github.com/uploadcare/uploadcare-upload-client/issues/251)) ([f5ab80a](https://github.com/uploadcare/uploadcare-upload-client/commit/f5ab80a295cd6e4fc59e426d9d73086999bf4197))
* **multipart:** use browser filename if option is not passed ([#250](https://github.com/uploadcare/uploadcare-upload-client/issues/250)) ([749e4a9](https://github.com/uploadcare/uploadcare-upload-client/commit/749e4a988b7d10ee9368433a4ffa076471a4d3e3))


## [1.1.1](https://github.com/uploadcare/uploadcare-upload-client/compare/v1.1.0...v1.1.1) (2020-03-16)


### Bug Fixes

* add is ready poll in `uploadFromUrl` ([#238](https://github.com/uploadcare/uploadcare-upload-client/issues/238)) ([dd0202d](https://github.com/uploadcare/uploadcare-upload-client/commit/dd0202d5ef2c787a63d345731ea2ccc39ecca70e))



# [1.1.0](https://github.com/uploadcare/uploadcare-upload-client/compare/v1.0.1...v1.1.0) (2020-03-03)


### Features

* implement push strategy with sockets for `uploadFromUrl` ([#222](https://github.com/uploadcare/uploadcare-upload-client/issues/222)) ([4cafe97](https://github.com/uploadcare/uploadcare-upload-client/commit/4cafe9759ebfe1f54b0e6d2f9cf2cffa36ec3283))
* add deferred disconnect for push strategy ([#229](https://github.com/uploadcare/uploadcare-upload-client/issues/229)) ([a9901f7](https://github.com/uploadcare/uploadcare-upload-client/commit/a9901f74aa1512471b3f4bd470ccc794eb31dac0))
* add strong typed event emitter ([#217](https://github.com/uploadcare/uploadcare-upload-client/issues/217)) ([35b9eef](https://github.com/uploadcare/uploadcare-upload-client/commit/35b9eef22ae0638d52915a2338e3c3978e3d6f2b))
* add custom race function ([#177](https://github.com/uploadcare/uploadcare-upload-client/issues/177)) ([219c02a](https://github.com/uploadcare/uploadcare-upload-client/commit/219c02aceb233886383e6d66c5ecdfbd5a1626ea))


### Bug Fixes

* make `fileName` optional and remove it from default settings ([#233](https://github.com/uploadcare/uploadcare-upload-client/issues/233)) ([a28d181](https://github.com/uploadcare/uploadcare-upload-client/commit/a28d181e5c412f6ff2aeee2e7ae02a7ae848c8a2))
* remove timeout from `uploadFromUrl` function ([#226](https://github.com/uploadcare/uploadcare-upload-client/issues/226)) ([76db2e4](https://github.com/uploadcare/uploadcare-upload-client/commit/76db2e4c607164afcaf07132789348927ea65577))
* use direct import for CancelController and rename callback to stopRace ([#216](https://github.com/uploadcare/uploadcare-upload-client/issues/216)) ([ea4ef7a](https://github.com/uploadcare/uploadcare-upload-client/commit/ea4ef7ac291ed1503e359901a315239563b53e83))


## [1.0.1](https://github.com/uploadcare/uploadcare-upload-client/compare/v1.0.0...v1.0.1) (2020-01-13)


### Bug Fixes

* **deps:** update dependency form-data to v3 ([#130](https://github.com/uploadcare/uploadcare-upload-client/issues/130)) ([1ece271](https://github.com/uploadcare/uploadcare-upload-client/commit/1ece271d8583ba257011d16b3f1930ad29329a96))



# [1.0.0](https://github.com/uploadcare/uploadcare-upload-client/compare/v1.0.0-alpha.5...v1.0.0) (2019-12-23)

### Changed

- All methods return a `Promise` now instead of `ThenableInterface`
- `SettingsInterface` was renamed to `Settings`
- `fileFrom` was renamed to `uploadFile`.
- `groupFrom` was renamed to `uploadFileGroup`.
- `request` low-level API method is not exported outside now.
- Method `setSettings` of `UploadClient` was renamed to `updateSettings`.
- Methods (`base`, `fromUrl`, `fromUrlStatus`, `group`,
  `groupInfo`, `info`, `multipartStart`, `multipartUpload`,
  `multipartComplete`, `multipart`, `uploadFile`, `uploadGroup`) were exported
  from `index.ts` to make the tree shaking better.
- Methods (`base`, `fromUrl`, `fromUrlStatus`, `group`,
  `groupInfo`, `info`, `multipartStart`, `multipartUpload`,
  `multipartComplete`, `multipart`, `uploadFile`, `uploadGroup`) accept
  `options` instead of `settings` as a second argument.
- `UploadClient` now contains all low-level API methods (`base`,
  `fromUrl`, `fromUrlStatus`, `group`, `groupInfo`, `info`,
  `multipartStart`, `multipartUpload`, `multipartComplete`, `multipart`,
  `fileFrom`, `groupFrom`).
- `UploadcareGroup` files now contain `UploadcareFile[]`, but not `FileInfo[]`.
- `README.md` was updated according to library API.
- `FileData` became `NodeFile` and `BrowserFile`.

### Removed

- `UploadAPI` class.
- `Thenable`, `CancelableThenable`, `BaseThenable`, `Upload` classes
  implementing respective interfaces.
- `onReady`, `onUploaded` callbacks.
- `addUpdateSettingsListener` and `removeUpdateSettingsListener` from
  `UploadClientInterface`.
- `from` param of `uploadFile` and `uploadFileGroup`.
- `FileFromEnum` and `GroupFromEnum`.

### Added

- `CancelController` to make API calls cancellable. See README for how
  to use this feature. ([#77](https://github.com/uploadcare/uploadcare-upload-client/issues/77))

## [1.0.0-alpha.5]

### Added

- Support of multipart and big files uploading: `multipartStart`,
  `multipartUpload`, and `multipartComplete` methods to `UploadAPI`.
- Support of canceling uploads and handling them for all API methods
  (`info`, `fromUrl`, `fromUrlStatus`, `group`, `groupInfo`).
- `DefaultSettingsInterface` with required properties.
- `pollingTimeoutMilliseconds` to `SettingsInterface`.
  Now you can adjust the timeout for checking is file ready,
  and checking is file being uploaded from URL.
- `maxConcurrentRequests` setting that allows you to specify the number
  of concurrent requests.

### Changed

- `FileFrom` enum was renamed to `FileFromEnum`.
- `GroupFrom` enum was renamed to `GroupFromEnum`.
- `Settings` was renamed to `SettingsInterface`.
- `FileInfo` was renamed to `FileInfoInterface`.
- `GroupInfo` was renamed to `GroupInfoInfoInterface`.
- `OriginalImageInfo` was renamed to `OriginalImageInfoInterface`.
- `RequestOptions` was renamed to `RequestOptionsInterface`.
- `ProgressStatus` was renamed to `ProgressStatusInterface`.
- `Audio` type was renamed to `AudioInterface`.
- `Video` type was renamed to `VideoInterface`.
- `ErrorRequestInfo` type was renamed to `ErrorRequestInfoInterface`.
- `ErrorResponseInfoInfo` type was renamed to `ErrorResponseInfoInterface`.
- `ProgressState` was renamed to `ProgressStateEnum`.
- `ProgressParams` was renamed to `ProgressParamsInterface`.
- `base` method of Upload API now returns `BaseThenableInterface<BaseResponse>`
  instead of `DirectUploadInterface`.
- `info`, `fromUrl`, `fromUrlStatus`, `group`, `groupInfo` now returns
  `CancelableThenableInterface`.
- Progress is now calculated from 0 to 1 instead of 0 to 100

### Fixed

- Example with `directUpload.onProgress` in `README.md`.
- All tests are passing now.
- Mock server tests are passing now.

### Removed

- `DirectUploadInterface` was removed in favor of `BaseThenableInterface<BaseResponse>`.
- `BaseProgress` was removed in favor of native `ProgressEvent`.
- `InfoResponse` was removed in favor of `FileInfoInterface`.
- Old code in folder `./.back`.

[1.0.0-alpha.5]: https://github.com/uploadcare/uploadcare-upload-client/compare/v1.0.0-alpha.4...v1.0.0-alpha.5

## [1.0.0-alpha.4]

### Added

- Wrappers for group paths of Upload API (`group`, `groupInfo`).
- The high-level function for group uploading, aka filesGroupFrom.
- Uploading progress for Node.js in the `base` method.

### Changed

- `UploadFromInterface` was renamed to `FileUploadInterface`.
- `FileProgress` was renamed to `ProgressParams`.
- `UploadcareFile` was renamed to `UploadcareFileInterface`.

[1.0.0-alpha.4]: https://github.com/uploadcare/uploadcare-upload-client/compare/v1.0.0-alpha.3...v1.0.0-alpha.4

## [1.0.0-alpha.3]

### Added

- Support `fileFrom` 'uploaded' file (`uuid`).
- Support of `waiting` status from `/from_url/status/` endpoint.
- Export some main types from the `index.ts` file.
  So you can import them now directly from `@uploadcare/upload-client`.
- Throttling for `request`.
- `retryThrottledMaxTimes` param to set count of max retries after
  throttled request (1 by default).
- `Uuid` type.
- Mock server for local testing.

### Fixed

- The default timeout for polling functions increased from 3s to 10s.
- Removed restrictions for timeout and interval.

[1.0.0-alpha.3]: https://github.com/uploadcare/uploadcare-upload-client/compare/v1.0.0-alpha.2...v1.0.0-alpha.3

## [1.0.0-alpha.2]

### Changed

- The project was moved from Flow notations to TypeScript.
- The `base` function now returns an object that implements
  `DirectUploadInterface`.
- The `fileFrom` function now returns an object that implements
  `UploadFromInterface`.
- The `UCFile` type renamed to `UploadcareFile`.
- The progress of `fileFrom` now based on the `UploadingProgress` type.

### Added

- Low-level request wrappers for `/from_url/` and `/from_url/status/`
  paths of Upload API.
- Settings: the support of setting `baseCDN`, `checkForUrlDuplicates`,
  `saveUrlForRecurrentUploads`.

[1.0.0-alpha.2]: https://github.com/uploadcare/uploadcare-upload-client/compare/v1.0.0-alpha.1...v1.0.0-alpha.2

## [1.0.0-alpha.1]

### Fixed

- Use the version from the `package.json` file to create Uploadcare User
  Agent.

### Changed

- The `base` function returns `thenable` object called `DirectUpload`
  instead of using the `promise` property.
- The `fileFrom` function returns `thenable` object called `FilePromise`
  instead of using the `promise` property.
- The `FileInfo` type renamed to `UCFile` and updated.
- The `FilePromise` resolved with an object of the `UploadcareFile` type.
- The progress of `fileFrom` now based on the `FilePromiseProgress` type.
- Updated the `InfoResponse` type.

### Added

- The `checkFileIsReady` function to check if the file is ready on the CDN.
- New properties for the object that the `fileFrom` function returns:
  `onUploaded`, `onReady`.
- The `camelizeKeys` function for inner usage.
- The `baseCDN` default setting

[1.0.0-alpha.1]: https://github.com/uploadcare/uploadcare-upload-client/compare/v1.0.0-alpha...v1.0.0-alpha.1

## 1.0.0-alpha

The first public alpha release.

### Added

- The `request` function to request to any path of [Upload API][upload-api].
- Low-level request wrappers for `/base/` and `/info/` paths of Upload API.
- `UploadClient` class with settings and `fileFrom` method that supports
  only direct uploads now.
- Support of following Uploadcare Settings: `publicKey`, `baseUrl`,
  `doNotStore`, `integration`, `secureExpire`, `secureSignature`.
- Test environment for both Node.js and browsers

[upload-api]: https://uploadcare.com/docs/api_reference/upload/
