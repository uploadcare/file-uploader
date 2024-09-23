<p align="center">
  <a href="https://uploadcare.com/?ref=github-readme">
    <picture>
      <source media="(prefers-color-scheme: light)" srcset="https://ucarecdn.com/1b4714cd-53be-447b-bbde-e061f1e5a22f/logosafespacetransparent.svg">
      <source media="(prefers-color-scheme: dark)" srcset="https://ucarecdn.com/3b610a0a-780c-4750-a8b4-3bf4a8c90389/logotransparentinverted.svg">
      <img width=250 alt="Uploadcare logo" src="https://ucarecdn.com/1b4714cd-53be-447b-bbde-e061f1e5a22f/logosafespacetransparent.svg">
    </picture>
  </a>
</p>
<p align="center">
  <a href="https://uploadcare.com/?ref=github-readme">Website</a> •
  <a href="https://uploadcare.com/docs/file-uploader?ref=github-readme">Docs</a> • 
  <a href="https://uploadcare.com/blog?ref=github-readme">Blog</a> • 
  <a href="https://discord.gg/mKWRgRsVz8?ref=github-readme">Discord</a> •
  <a href="https://twitter.com/Uploadcare?ref=github-readme">Twitter</a>
</p>

# Uploadcare File Uploader

[![npm version](https://badge.fury.io/js/@uploadcare%2Ffile-uploader.svg)](https://www.npmjs.com/package/@uploadcare/file-uploader)
[![GitHub Actions](https://github.com/uploadcare/blocks/workflows/checks/badge.svg)](https://github.com/uploadcare/blocks/actions?query=workflow%3ABuild+branch%3Amaster)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/@uploadcare/file-uploader@latest)](https://bundlephobia.com/package/@uploadcare/file-uploader@latest)

Add file uploads to your app and configure behavior and appearance as needed. Process and transform files before and after uploading. Compatible with any framework or environment.

<img alt="Uploadcare File Uploader examples" src="https://ucarecdn.com/916a1054-ca44-4c4a-9f7b-99fa499043d9/-/preview/">

## Features

- **Multiple upload sources:** Drop files, select from the filesystem, use a link, camera, Dropbox, Google Drive, add them via the upload API, and more.
- **Large file handling:** Upload faster with chunking, retries, and resumable uploads.
- **Customizable appearance:** Use pre-built themes or modify styles with CSS to fit your project.
- **Responsive and cross-browser:** Fits any device; supports the latest desktop and mobile versions of Chrome, Edge, Firefox, Opera, and Safari.
- **Fully accessible:** A11Y options, including keyboard navigation, screen reader support, and color contrast settings.
- **Advanced image editing:** Optimize images and apply smart transformations like cropping, resizing, or color filters via the built-in image editor, REST, or URL API.
- **Secure uploads:** Protect your app by automatically detecting inappropriate content, malicious files, or unauthorized uploads.
- **Typescript support:** Full Typescript support with autocompletion, type checking, and more for a better developer experience.

## Framework support

Uploadcare File Uploader is built with [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components), meaning you can integrate it into any environment—no adapters required.

For hands-on examples, visit our live sandboxes:

- [React](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/react-uploader)
- [Next.js](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/next-uploader)
- [JavaScript](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/js-uploader)
- [Angular](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/angular-uploader)
- [Vue](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/vue-uploader)
- [Svelte](https://github.com/uploadcare/file-uploader-examples/tree/main/examples/svelte-uploader)

Check out the [documentation](https://uploadcare.com/docs/integrations/?ref=github-readme) for quickstart guides tailored to your framework or tool.

Explore more tutorials in our [blog](https://uploadcare.com/blog/category/uploading/?ref=github-readme).

## Quick Start

### From CDN

1. Connect File Uploader directly from your document:

```html
<script type="module">
  import * as UC from 'https://cdn.jsdelivr.net/npm/@uploadcare/file-uploader@1/web/file-uploader.min.js';

  UC.defineComponents(UC);
</script>
```

2. Add File Uploader in your application markup:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@uploadcare/file-uploader@1/web/uc-file-uploader-regular.min.css"
/>

<uc-file-uploader-regular ctx-name="my-uploader"> </uc-file-uploader-regular>
```

3. Configure File Uploader and add your personal public key to the project. [Learn more](#configuration).

### From NPM

1. Install the package: `npm i @uploadcare/file-uploader`
2. Connect File Uploader from your script file:

```js
import * as UC from '@uploadcare/file-uploader';

UC.defineComponents(UC);
```

3. Add File Uploader in your application markup:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@uploadcare/file-uploader@1/web/uc-file-uploader-regular.min.css"
/>

<uc-file-uploader-inline ctx-name="my-uploader"> </uc-file-uploader-inline>
```

4. Configure File Uploader and add your personal public key to the project. [Learn more](#configuration).

### Configuration

All configurations in File Uploader are managed from `uc-config` block.

1. Sign up to [Uploadcare](https://app.uploadcare.com/accounts/signup/?ref=github-readme).
2. Get a Public API key in [Uploadcare project's dashboard](https://app.uploadcare.com/projects/-/api-keys/?ref=github-readme).
3. Add a `uc-config` block to your markup and replace `YOUR_PUBLIC_KEY` with your own public key:

```html
<uc-config ctx-name="my-uploader" pubkey="YOUR_PUBLIC_KEY"></uc-config>
```

4. Make sure that your config uses the same `ctx-name` attribute value as your solution block.

Discover more about configuration options in [our documentation](https://uploadcare.com/docs/file-uploader/configuration/?ref=github-readme).

## Browser support

Latest desktop and mobile stable versions of Chrome, Edge, Firefox, Opera, and Safari are supported.

Internet Explorer is outdated and [not supported anymore](https://uploadcare.com/blog/uploadcare-stops-internet-explorer-support/?ref=github-readme).

## Contribution

You’re always welcome to contribute:

- Create [issues](https://github.com/uploadcare/file-uploader/issues) every time you feel something is missing or goes wrong.
- Provide your feedback or drop us a support request at <a href="mailto:hello@uploadcare.com">hello@uploadcare.com</a>.
- Ask questions on [Stack Overflow](https://stackoverflow.com/questions/tagged/uploadcare) with "uploadcare" tag if others can have these questions as well.
- Fork project, make changes and send it as pull request. For launching the developing mode follow these commands:
  - Install dependencies: `npm install`.
  - Start local dev-server: `npm run dev`.
- Star this repo if you like it ⭐️
