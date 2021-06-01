# Uploadcare Upload Client

<a href="https://uploadcare.com/?utm_source=github&utm_campaign=uploadcare-upload-client">
    <img align="right" width="64" height="64"
      src="https://ucarecdn.com/edfdf045-34c0-4087-bbdd-e3834921f890/userpiccircletransparent.svg"
      alt="">
</a>

This is an Uploadcare [Upload API][uc-docs-upload-api] wrapper to work with
Node.js and browser.

[![Build Status][badge-build]][build-url]
[![NPM version][npm-img]][npm-url]
[![GitHub release][badge-release-img]][badge-release-url]&nbsp;
[![Uploadcare stack on StackShare][badge-stack-img]][badge-stack-url]

<!-- toc -->

- [Install](#install)
- [Usage](#usage)
  - [High-Level API](#high-level-api)
  - [Low-Level API](#low-level-api)
  - [Settings](#settings)
- [Testing](#testing)
- [Security issues](#security-issues)
- [Feedback](#feedback)

<!-- tocstop -->

## Install

```bash
npm install @uploadcare/upload-client
```

## Usage

### High-Level API

To access the High-Level API, you need to create an instance of `UploadClient`
providing the necessary settings. Specifying `YOUR_PUBLIC_KEY` is mandatory: it
points to the specific Uploadcare project:

```javascript
import UploadClient from '@uploadcare/upload-client'

const client = new UploadClient({ publicKey: 'YOUR_PUBLIC_KEY' })
```

Once the UploadClient instance is created, you can start using the wrapper to
upload files from binary data:

```javascript
client
  .uploadFile(fileData)
  .then(file => console.log(file.uuid))
```

Another option is uploading files from URL, via the `uploadFile` method:

```javascript
const fileURL = 'https://example.com/file.jpg'

client
  .uploadFile(fileURL)
  .then(file => console.log(file.uuid))
```

You can also use the `uploadFile` method to get previously uploaded files via
their UUIDs:

```javascript
const fileUUID = 'edfdf045-34c0-4087-bbdd-e3834921f890'

client
  .uploadFile(fileUUID)
  .then(file => console.log(file.uuid))
```

You can track uploading progress:

```javascript
const fileUUID = 'edfdf045-34c0-4087-bbdd-e3834921f890'
const onProgress = ({ value }) => {
  console.log(value)
}

client
  .uploadFile(fileUUID, { onProgress })
  .then(file => console.log(file.uuid))
```

You can cancel file uploading and track this event:

```javascript
const fileUUID = 'edfdf045-34c0-4087-bbdd-e3834921f890'
const controller = new CancelController()

client
  .uploadFile(fileUUID, { cancel: controller })
  .then(file => console.log(file.uuid))
  .catch(error => {
    if (error.isCancel) {
      console.log(`File uploading was canceled.`)
    }
  })

// Cancel uploading
controller.cancel()
```

List of all available `UploadClient` API methods:

```typescript
interface UploadClient {
  updateSettings(newSettings: Settings = {}): void

  getSettings(): Settings

  base(
    file: NodeFile | BrowserFile,
    options: BaseOptions
  ): Promise<BaseResponse>

  info(uuid: Uuid, options: InfoOptions): Promise<FileInfo>

  fromUrl(sourceUrl: Url, options: FromUrlOptions): Promise<FromUrlResponse>

  fromUrlStatus(
    token: Token,
    options: FromUrlStatusOptions
  ): Promise<FromUrlStatusResponse>

  group(uuids: Uuid[], options: GroupOptions): Promise<GroupInfo>

  groupInfo(id: GroupId, options: GroupInfoOptions): Promise<GroupInfo>

  multipartStart(
    size: number,
    options: MultipartStartOptions
  ): Promise<MultipartStartResponse>

  multipartUpload(
    part: Buffer | Blob,
    url: MultipartPart,
    options: MultipartUploadOptions
  ): Promise<MultipartUploadResponse>

  multipartComplete(
    uuid: Uuid,
    options: MultipartCompleteOptions
  ): Promise<FileInfo>

  uploadFile(
    data: NodeFile | BrowserFile | Url | Uuid,
    options: FileFromOptions
  ): Promise<UploadcareFile>

  uploadFileGroup(
    data: (NodeFile | BrowserFile)[] | Url[] | Uuid[],
    options: FileFromOptions & GroupFromOptions
  ): Promise<UploadcareGroup>
}
```

### Low-Level API

Also, you can use low-level wrappers to call the API endpoints directly:

```javascript
import { base, CancelController } from '@uploadcare/upload-client'

const onProgress = ({ value }) => console.log(value)
const cancelController = new CancelController()

base(fileData, { onProgress, cancel: cancelController }) // fileData must be `Blob` or `File` or `Buffer`
  .then(data => console.log(data.file))
  .catch(error => {
    if (error.isCancel) {
      console.log(`File uploading was canceled.`)
    }
  })

// Also you can cancel upload:
cancelController.cancel()
```

List of all available API methods:

```typescript
base(
  file: NodeFile | BrowserFile,
  options: BaseOptions
): Promise<BaseResponse>
```

```typescript
info(uuid: Uuid, options: InfoOptions): Promise<FileInfo>
```

```typescript
fromUrl(sourceUrl: Url, options: FromUrlOptions): Promise<FromUrlResponse>
```

```typescript
fromUrlStatus(
  token: Token,
  options: FromUrlStatusOptions
): Promise<FromUrlStatusResponse>
```

```typescript
  group(uuids: Uuid[], options: GroupOptions): Promise<GroupInfo>
```

```typescript
  groupInfo(id: GroupId, options: GroupInfoOptions): Promise<GroupInfo>
```

```typescript
multipartStart(
  size: number,
  options: MultipartStartOptions
): Promise<MultipartStartResponse>
```

```typescript
multipartUpload(
  part: Buffer | Blob,
  url: MultipartPart,
  options: MultipartUploadOptions
): Promise<MultipartUploadResponse>
```

```typescript
multipartComplete(
  uuid: Uuid,
  options: MultipartCompleteOptions
): Promise<FileInfo>
```

```typescript
multipart(
  file: File | Buffer | Blob,
  options: MultipartOptions
): Promise<FileInfo>
```

### Settings

#### `publicKey: string`

The main use of a `publicKey` is to identify a target project for your uploads.
It is required when using Upload API.

#### `baseCDN: string`

Defines your schema and CDN domain. Can be changed to one of the predefined
values (`https://ucarecdn.com/`) or your custom CNAME.

Defaults to `https://ucarecdn.com/`.

#### `baseURL: string`

API base URL.

Defaults to `https://upload.uploadcare.com`

#### `fileName: string`

You can specify an original filename.

Defaults to `original`.

#### `store: boolean`

Forces files uploaded with `UploadClient` to be stored or not. For instance,
you might want to turn this off when automatic file storing is enabled in your
project, but you do not want to store files uploaded with a particular instance.

#### `secureSignature: string`

In case you enable signed uploads for your project, you’d need to provide
the client with `secureSignature` and `secureExpire` params.

The `secureSignature` is an MD5 hex-encoded hash from a concatenation
of `API secret key` and `secureExpire`.

#### `secureExpire: string`

Stands for the Unix time to which the signature is valid, e.g., `1454902434`.

#### `integration: string`

`X-UC-User-Agent` header value.

Defaults to `UploadcareUploadClient/${version}/${publicKey} (JavaScript; ${integration})`

#### `checkForUrlDuplicates: boolean`

Runs the duplicate check and provides the immediate-download behavior.

#### `saveUrlForRecurrentUploads: boolean`

Provides the save/update URL behavior. The parameter can be used if you believe
that the `sourceUrl` will be used more than once. Using the parameter also
updates an existing reference with a new `sourceUrl` content.

#### `source: string`

Defines the upload source to use, can be set to local, url, etc.

#### `jsonpCallback: string`

Sets the name of your JSONP callback function to create files group from a set
of files by using their UUIDs.

#### `maxContentLength: number`

`maxContentLength` defines the maximum allowed size (in bytes) of the HTTP
response content.

Defaults to `52428800` bytes (50 MB).

#### `retryThrottledRequestMaxTimes: number`

Sets the maximum number of attempts to retry throttled requests.

Defaults to `1`.

#### `multipartChunkSize: number`

This option is only applicable when handling local files.
Sets the multipart chunk size.

Defaults to `5242880` bytes (5 MB).

#### `multipartMinFileSize: number`

This option is only applicable when handling local files.
Sets the multipart uploading file size threshold: larger files
will be uploaded in the Multipart mode rather than via Direct Upload.
The value is limited to the range from `10485760` (10 MB) to `104857600` (100 MB).

Defaults to `26214400` (25 MB).

#### `multipartMinLastPartSize: number`

This option is only applicable when handling local files. Set the minimum size
of the last multipart part.

Defaults to `1048576` bytes (1 MB).

#### `maxConcurrentRequests: number`

Allows specifying the number of concurrent requests.

Defaults to `4`.

### `contentType: string`

This setting is needed for correct multipart uploads.

Defaults to `application/octet-stream`.

## Testing

```
npm run test
```

By default, tests runs with mock server, but you can run tests with
production environment.

Run test on production servers: 

```bash
npm run test:production
```

Run test with mock server (mock server starts automaticaly):

```bash
npm run test
```

Run mock server:

```
npm run mock:start
```

And then you can run test:

```
npm run test:jest
```

## Security issues

If you think you ran into something in Uploadcare libraries that might have
security implications, please hit us up at
[bugbounty@uploadcare.com][uc-email-bounty] or Hackerone.

We'll contact you personally in a short time to fix an issue through co-op and
prior to any public disclosure.

## Feedback

Issues and PRs are welcome. You can provide your feedback or drop us a support
request at [hello@uploadcare.com][uc-email-hello].

[uc-email-bounty]: mailto:bugbounty@uploadcare.com
[uc-email-hello]: mailto:hello@uploadcare.com
[github-releases]: https://github.com/uploadcare/uploadcare-upload-client/releases
[github-branch-release]: https://github.com/uploadcare/uploadcare-upload-client/tree/release
[github-contributors]: https://github.com/uploadcare/uploadcare-upload-client/graphs/contributors
[badge-stack-img]: https://img.shields.io/badge/tech-stack-0690fa.svg?style=flat
[badge-stack-url]: https://stackshare.io/uploadcare/stacks/
[badge-release-img]: https://img.shields.io/github/release/uploadcare/uploadcare-upload-client.svg
[badge-release-url]: https://github.com/uploadcare/uploadcare-upload-client/releases
[npm-img]: http://img.shields.io/npm/v/@uploadcare/upload-client.svg
[npm-url]: https://www.npmjs.org/package/@uploadcare/upload-client
[badge-build]: https://img.shields.io/github/workflow/status/uploadcare/uploadcare-upload-client/Ship%20js%20trigger
[build-url]: https://github.com/uploadcare/uploadcare-upload-client/actions?query=workflow%3A%22Ship+js+trigger%22
[uc-docs-upload-api]: https://uploadcare.com/docs/api_reference/upload/?utm_source=github&utm_campaign=uploadcare-upload-client
