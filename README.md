<p align="center">
  <a href="https://uploadcare.com/?ref=github-readme">
    <picture>
      <source media="(prefers-color-scheme: light)" srcset="https://ucarecdn.com/27eed822-4a34-4347-b227-a89df2e7bf47/githubuploadcarelockuplight320x58.svg">
      <source media="(prefers-color-scheme: dark)" srcset="https://ucarecdn.com/dfd6c07b-fd17-4559-8803-bc98f92b564b/githubuploadcarelockupdark320x58.svg">
      <img width=250 alt="Uploadcare logo" src="https://ucarecdn.com/27eed822-4a34-4347-b227-a89df2e7bf47/githubuploadcarelockuplight320x58.svg">
    </picture>
  </a>
</p>
<p align="center">
  <a href="https://uploadcare.com/products/file-uploader/?ref=github-readme">Website</a> •
  <a href="https://uploadcare.com/docs/file-uploader/?ref=github-readme">Docs</a> •
  <a href="https://github.com/uploadcare/file-uploader-examples">Examples</a> •
  <a href="https://uploadcare.com/blog/?ref=github-readme">Blog</a> •
  <a href="https://twitter.com/Uploadcare?ref=github-readme">Twitter</a>
</p>

# Uploadcare File Uploader

[![npm version](https://badge.fury.io/js/@uploadcare%2Ffile-uploader.svg)](https://www.npmjs.com/package/@uploadcare/file-uploader)
[![checks](https://github.com/uploadcare/file-uploader/actions/workflows/checks.yml/badge.svg)](https://github.com/uploadcare/file-uploader/actions/workflows/checks.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/@uploadcare/file-uploader@latest)](https://bundlephobia.com/package/@uploadcare/file-uploader@latest)

`@uploadcare/file-uploader` is a drop-in file upload widget with storage, processing, and delivery already behind it. It's built from Web Components, so it runs natively in React, Next.js, Vue, Angular, Svelte, or plain HTML. Users upload files up to 5 TB from their device, camera, a link, or cloud accounts like Dropbox and Google Drive, and every upload can be validated, signed, and scanned before it reaches storage.

<img alt="Uploadcare File Uploader examples" src="https://ucarecdn.com/916a1054-ca44-4c4a-9f7b-99fa499043d9/-/preview/">

## Key takeaways

- **One widget, many sources.** Local files, camera (photo and video), URL, clipboard paste, Dropbox, Google Drive, Google Photos, OneDrive, Box, Facebook, and custom sources via plugins.
- **Big files just work.** Chunked, parallel multipart uploads with retries, up to 5 TB per file.
- **Any stack, no adapter required.** Native Custom Elements, with an optional [React adapter](https://www.npmjs.com/package/@uploadcare/react-uploader) for React and Next.js.
- **Drop-in or headless.** Use a ready-made solution, a compact dynamic button, or hide the UI and trigger the flow from your own button.
- **Two image editors:** 
  - The built-in Cloud Image Editor crops, rotates, flips, adjusts, and filters images, saving edits as CDN URL operations so the original stays untouched. 
  - The [AI Image Editor plugin](https://uploadcare.com/docs/file-uploader/ai-image-editor/?ref=github-readme) (beta) generates new images and edits uploaded ones from a prompt.
- **Secure by default.** Type, size, and count validation; signed uploads with auth tokens; malware scanning and content moderation on your project.
- **Extensible.** The Plugin API adds upload sources, UI activities, file actions, and pre-upload hooks without forking.
- **Accessible and localized.** Keyboard navigation, screen reader support, and translatable UI text.

## Quick start

### 1. Get a public key

[Sign up](https://app.uploadcare.com/accounts/signup/?ref=github-readme) and copy your public key from the [API keys page](https://app.uploadcare.com/projects/-/api-keys/?ref=github-readme). The [dashboard configurator](https://app.uploadcare.com/projects/-/get-started/?ref=github-readme) can also generate a ready-to-paste snippet for your stack.

### 2. Install

<details open>
<summary><b>npm</b></summary>

```sh
npm i @uploadcare/file-uploader
```

```js
import * as UC from "@uploadcare/file-uploader";
import "@uploadcare/file-uploader/index.css";

UC.defineComponents(UC);
```

</details>

<details>
<summary><b>CDN (no build step)</b></summary>

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@uploadcare/file-uploader@1/web/uc-file-uploader-regular.min.css"
/>

<script type="module">
  import * as UC from "https://cdn.jsdelivr.net/npm/@uploadcare/file-uploader@1/web/file-uploader.min.js";

  UC.defineComponents(UC);
</script>
```

</details>

<details>
<summary><b>React and Next.js</b></summary>

```sh
npm i @uploadcare/react-uploader
```

```tsx
import { FileUploaderRegular } from "@uploadcare/react-uploader";
// For Next.js App Router: import from "@uploadcare/react-uploader/next" in a "use client" component
import "@uploadcare/react-uploader/core.css";

export default function Uploader() {
  return (
    <FileUploaderRegular
      pubkey="YOUR_PUBLIC_KEY"
      sourceList="local, camera, url, gdrive"
      onChange={(state) => {
        state.successEntries.forEach((file) => console.log(file.uuid, file.cdnUrl));
      }}
    />
  );
}
```

With React you can skip steps 3 and 4 below: config attributes become props, and events become callbacks.

</details>

### 3. Add the uploader to your markup

```html
<uc-config
  ctx-name="my-uploader"
  pubkey="YOUR_PUBLIC_KEY"
  source-list="local, camera, url, gdrive"
></uc-config>

<uc-file-uploader-regular ctx-name="my-uploader"></uc-file-uploader-regular>

<uc-upload-ctx-provider ctx-name="my-uploader"></uc-upload-ctx-provider>
```

All blocks that share a `ctx-name` work together. `<uc-config>` holds the [configuration](https://uploadcare.com/docs/file-uploader/configuration/?ref=github-readme), and `<uc-upload-ctx-provider>` gives you [events](https://uploadcare.com/docs/file-uploader/events/?ref=github-readme) and the [API](https://uploadcare.com/docs/file-uploader/api/?ref=github-readme).

### 4. Handle uploaded files

```js
const ctx = document.querySelector('uc-upload-ctx-provider[ctx-name="my-uploader"]');

ctx.addEventListener("change", (e) => {
  e.detail.successEntries.forEach((file) => {
    // Save file.uuid or file.cdnUrl to your app
    console.log(file.uuid, file.cdnUrl);
  });
});
```

Using a plain HTML form? Add [`<uc-form-input>`](https://uploadcare.com/docs/file-uploader/html-forms/?ref=github-readme) and the file URLs are submitted with the form.

### 5. Lock it down (recommended for production)

Turn on [signed uploads](https://uploadcare.com/docs/security/secure-uploads/?ref=github-readme) and give the uploader a function that fetches a token from your backend:

```js
document.querySelector("uc-config").authToken = async () => {
  const response = await fetch("/uploadcare-token");
  if (!response.ok) throw new Error(`token endpoint: ${response.status}`);
  const { token } = await response.json();
  return token;
};
```

The uploader caches the token, refreshes it before it expires, and retries once with a new token if one is refused. Never put your secret key in client code.

## Solutions

Pick the one that fits your layout. Each one includes the image editor and can be styled with CSS.

| Solution | Tag | Best for |
| --- | --- | --- |
| [Regular](https://uploadcare.com/docs/file-uploader/?ref=github-readme#regular) | `<uc-file-uploader-regular>` | A button that opens an upload dialog |
| [Inline](https://uploadcare.com/docs/file-uploader/?ref=github-readme#inline) | `<uc-file-uploader-inline>` | The full uploader embedded in a page or form |
| [Minimal](https://uploadcare.com/docs/file-uploader/?ref=github-readme#minimal) | `<uc-file-uploader-minimal>` | A compact drag-and-drop area |

The Regular solution has two extra modes:

- **[Dynamic button](https://uploadcare.com/docs/file-uploader/dynamic-button/?ref=github-readme)** (`dynamic-button`): a compact, state-aware control for toolbars, chat composers, and CMS fields. It shows your sources, accepts drops, and tracks progress.
- **[Headless](https://uploadcare.com/docs/file-uploader/installation/?ref=github-readme#headless-mode)** (`headless`): hides the default button so you can call `api.initFlow()` from your own UI.

## Features

### File uploads

- **Upload from anywhere:** local files, camera, direct link, clipboard paste, Dropbox, Google Drive, Google Photos, OneDrive, Box, and Facebook.
- **Files up to 5 TB:** large files are split into chunks and uploaded in parallel, with retries.
- **Multiple file upload:** set the minimum and maximum number of files per upload.
- **Drag and drop:** users drop files into the uploader or pick them from a dialog.
- **Upload progress:** a progress bar for every file, in list or grid view.
- **Camera capture:** take photos or record video, with control over aspect ratio, resolution, audio, and format.
- **Client-side image shrink:** resize large images in the browser before upload.
- **Metadata and tags:** attach metadata and tags to uploaded files.

### What users see

- **Image previews:** thumbnails of selected files before upload.
- **[Cloud Image Editor](https://uploadcare.com/docs/file-uploader/image-editor/?ref=github-readme):** built in. Crop, rotate, flip, adjust brightness, exposure, contrast, and saturation, and apply filters. Edits are saved as CDN URL operations, so the original file is never changed.
- **[AI Image Editor](https://uploadcare.com/docs/file-uploader/ai-image-editor/?ref=github-readme):** an optional plugin (public beta). It adds a **Generate image** source and an **AI Edit** action on uploaded images, and the result is saved as a new file.
- **Accessibility:** keyboard navigation through uploads and the editor, plus screen reader and voice assistant support. [Details](https://uploadcare.com/docs/file-uploader/a11y/?ref=github-readme).
- **Localization:** UI text, errors, and validation messages in many locales, with your own overrides. [Details](https://uploadcare.com/docs/file-uploader/localization/?ref=github-readme).
- **Theming:** light and dark modes, radius presets, and CSS variables. [Details](https://uploadcare.com/docs/file-uploader/styling/?ref=github-readme).

### Build it your way

- **Drop-in or headless:** use a ready-made solution, or drive the flow from your own UI.
- **[Plugin API](https://uploadcare.com/docs/file-uploader/plugins/?ref=github-readme):** add upload sources, UI activities, per-file actions, pre-upload file hooks, icons, translations, and config options.
- **Events and API:** listen to the upload lifecycle and control the uploader from code.
- **TypeScript support:** type definitions ship with the package, including JSX types.

### Security and control

- **[File validation](https://uploadcare.com/docs/file-uploader/validators/?ref=github-readme):** limit uploads by type, size, and count, or write your own file and collection validators.
- **[Signed uploads](https://uploadcare.com/docs/file-uploader/security/?ref=github-readme):** control who can upload and for how long, with auth tokens or signatures.
- **Malware scanning and content moderation:** scan uploads and block or flag unsafe files on your Uploadcare project.
- **Safe file handling:** blocks code execution through uploaded SVG, HTML, and XML files.

### Storage and delivery

- **Your storage or ours:** keep files in Uploadcare storage, or connect your own S3 bucket.
- **Global CDN:** files are delivered from edge locations worldwide.
- **Processing on the same files:** image transformations, video encoding, and document conversion through the [URL and REST APIs](https://uploadcare.com/docs/?ref=github-readme).
- **Webhooks:** run your own logic when files are uploaded, converted, or deleted.

## Plugins

Plugins add functionality to the uploader without forking it. A plugin is an object with an `id` and a `setup` function:

```js
const myPlugin = {
  id: "my-plugin",
  setup({ pluginApi, uploaderApi }) {
    pluginApi.registry.registerSource({
      id: "my-source", // add it to source-list to show it
      label: "my-source.label",
      icon: "upload",
      onSelect() {
        uploaderApi.setCurrentActivity("my-activity");
        uploaderApi.setModalState(true);
      },
    });
  },
};

document.querySelector("uc-config").plugins = [myPlugin];
```

See [plugin structure](https://uploadcare.com/docs/file-uploader/plugins/plugin-structure/?ref=github-readme), [extension points](https://uploadcare.com/docs/file-uploader/plugins/extension-points/?ref=github-readme), and the [complete Unsplash source example](https://uploadcare.com/docs/file-uploader/plugins/example/?ref=github-readme).

## Framework support

File Uploader is built from [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components), so it runs in any environment. Ready-to-run examples:

| Framework | Web Components | React adapter |
| --- | --- | --- |
| JavaScript | [js-uploader](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/js-uploader) | — |
| React | [react-uploader](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/react-uploader) | [react-uploader-adapter](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/react-uploader-adapter) |
| Next.js | [next-uploader](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/next-uploader) | [next-uploader-adapter](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/next-uploader-adapter) |
| Vue | [vue-uploader](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/vue-uploader) | — |
| Angular | [angular-uploader](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/angular-uploader) | — |
| Svelte | [svelte-uploader](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/svelte-uploader) | — |

Setup guides for each framework are in the [integrations docs](https://uploadcare.com/docs/integrations/frameworks-file-uploader/?ref=github-readme). For SSR setups without conditional exports, or older build tools, use [`loadFileUploaderFrom`](https://uploadcare.com/docs/file-uploader/installation/?ref=github-readme#dynamic-script-connection) to load the uploader in the browser only.

Back-end SDKs are available for [JavaScript, PHP, Python, Ruby, Go, Java, and Rust](https://uploadcare.com/docs/integrations/?ref=github-readme), and there are native uploaders for [iOS](https://uploadcare.com/docs/integrations/swift/?ref=github-readme) and [Android](https://uploadcare.com/docs/integrations/android/?ref=github-readme).

## Integrate with an AI assistant

The [installation docs](https://uploadcare.com/docs/file-uploader/installation/?ref=github-readme) include a one-click prompt for Cursor, Claude, and ChatGPT. It detects your framework, asks which sources and mode you want, and sets up the uploader and result handling. The library is also indexed on [Context7](https://context7.com/uploadcare/file-uploader).

## TypeScript

Types load automatically when you import the package. To type-check the uploader's custom elements in JSX, add:

```json
{
  "compilerOptions": {
    "types": ["@uploadcare/file-uploader/types/jsx"]
  }
}
```

## Browser support

The latest stable desktop and mobile versions of Chrome, Edge, Firefox, Opera, and Safari are supported. Internet Explorer is [not supported](https://uploadcare.com/blog/uploadcare-stops-internet-explorer-support/?ref=github-readme).

## Security and compliance

Uploadcare is SOC 2 Type II audited and GDPR compliant, with HIPAA-ready workflows available. The Upload API has a 99.9% uptime SLA. See the [Trust Center](https://trust.uploadcare.com/) for current certifications.

## Migrating

- From an older `@uploadcare/file-uploader` or `@uploadcare/blocks` version: follow the [migration guides](https://uploadcare.com/docs/file-uploader/migration/?ref=github-readme).
- From the jQuery widget (`uploadcare-widget`, deprecated as of September 2025): start with the [installation guide](https://uploadcare.com/docs/file-uploader/installation/?ref=github-readme).

## Quality Insights

Quality Insights is a plugin for File Uploader that helps us understand how the uploader is used: which features are enabled, which scenarios occur most often, and how the upload process works overall.

We pay particular attention to error data, so we can find and fix issues quickly and make the uploader more stable. All collected data is non-personal, does not identify individual users, and is never shared with external services. We use it only within the product to set development priorities and improve the uploader for its users.

## Contributing

You're always welcome to contribute:

- Open an [issue](https://github.com/uploadcare/file-uploader/issues) when something is missing or broken.
- Send feedback or a support request to <a href="mailto:hello@uploadcare.com">hello@uploadcare.com</a>.
- Ask questions on [Stack Overflow](https://stackoverflow.com/questions/tagged/uploadcare) with the `uploadcare` tag.
- Fork the project and send a pull request. See [CONTRIBUTING.md](./CONTRIBUTING.md), then:
  - Install dependencies: `npm install`
  - Start the dev server: `npm run dev`
  - Run tests: `npm test`
- Star this repo if you like it ⭐️

## License

[MIT](./LICENSE)
