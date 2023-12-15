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
  <a href="https://uploadcare.com?ref=github-readme">Website</a> • 
  <a href="https://uploadcare.com/docs/start/quickstart?ref=github-readme">Quick Start</a> • 
  <a href="https://uploadcare.com/docs?ref=github-readme">Docs</a> • 
  <a href="https://uploadcare.com/blog?ref=github-readme">Blog</a> • 
  <a href="https://discord.gg/mKWRgRsVz8?ref=github-readme">Discord</a> •
  <a href="https://twitter.com/Uploadcare?ref=github-readme">Twitter</a>
</p>

# 📦 Uploadcare Blocks: stack-agnostic library for uploading, processing, and editing images on-the-fly

[![npm version](https://badge.fury.io/js/@uploadcare%2Fblocks.svg)](https://www.npmjs.com/package/@uploadcare/blocks)
[![GitHub Actions](https://github.com/uploadcare/blocks/workflows/checks/badge.svg)](https://github.com/uploadcare/blocks/actions?query=workflow%3ABuild+branch%3Amaster)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

_Uploadcare Blocks_ is a powerful JavaScript library for creating custom file-handling services.
It includes various interactive and customizable UI components to enhance users' file uploading
and processing experience. As a bonus, you receive all the
[Uploadcare's](https://uploadcare.com/?ref=github-readme) versatile file-handling capabilities,
including [smart CDN](https://uploadcare.com/docs/delivery/cdn/#content-delivery-network/?ref=github-readme),
[MIME-type filtering](https://uploadcare.com/docs/moderation/#file-types/?ref=github-readme),
[signed uploads](https://uploadcare.com/docs/security/secure-uploads/?ref=github-readme),
and [even more](<(https://uploadcare.com/features/?ref=github-readme)>).

See Uploadcare Blocks [in action](https://codesandbox.io/s/file-uploader-regular-demo-mm3znl?file=/index.html)!

<img alt="Uploadcare Blocks examples" src="https://ucarecdn.com/8035cdc7-f0b9-4ea9-8c15-05816f315481/">

## Core features

- [File Uploader](https://uploadcare.com/docs/file-uploader/?ref=github-readme) — implement file-managing functionality with minimal or comprehensive interfaces in just a few minutes.
<!-- - [Advanced Customization](/blocks/) — create unique file-uploading interfaces by reorganizing pre-built components and styles with custom based on your needs. -->
- [Adaptive Images](https://uploadcare.com/docs/adaptive-image/?ref=github-readme) — build responsive user interfaces that adapt to various screen sizes and devices, ensuring a performant experience across platforms.
- [Cloud Image Editor](https://uploadcare.com/docs/file-uploader/image-editor/?ref=github-readme) — edit, transform, and process images right from a browser on-the-fly.
- [Uploadcare power and features](https://uploadcare.com/features/?ref=github-readme) — upload, process, deliver, and manage images without building custom infrastructure.

* **Coming soon!** Web Components for any media content management like audio, video, image galleries, and more.

## Why Uploadcare Blocks?

### Rapid integration

We provide a ready-to-use set of UI components for file handling. It saves you valuable development time and effort, allowing you to focus on other core aspects of your application. You even don't need to build a stage while developing — just run the code directly from the browser.

### Cross-platform compatibility

Uploadcare Blocks are designed to work seamlessly across various platforms and frameworks. Whether you're building a web application using React, Vue.js, Angular, Svelte, or other frameworks, you get [integrations and support](https://uploadcare.com/docs/integrations/?ref=github-readme) for various development environments.

### Developer-friendly

The library comes with modern technologies at your fingertips, like [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components), [ESM-level](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) code sharing, and other cutting-edge web standards. _Uploadcare Blocks_ is designed lightweight with minimum external dependencies for a cheap security audit.

### Typescript support

We use [JSDoc type annotations](https://www.typescriptlang.org/docs/handbook/intro-to-js-ts.html) and type definitions ([\*.d.ts files](https://www.typescriptlang.org/docs/handbook/declaration-files/dts-from-js.html)) for TypeScript static analysis support during development.

## 🚀 Getting started

### From CDN

1. Connect Uploadcare Blocks directly from your document replacing `{{PACKAGE_VERSION}}` with the [latest version](https://github.com/uploadcare/blocks/releases) of the package:

```html
<script type="module">
  import * as LR from 'https://cdn.jsdelivr.net/npm/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/blocks.min.js';

  LR.registerBlocks(LR);
</script>
```

2. Start using Uploadcare Blocks in your application markup (don't forget to specify `{{PACKAGE_VERSION}}` with the [latest one](https://github.com/uploadcare/blocks/releases)):

```html
<lr-file-uploader-regular
  css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/lr-file-uploader-regular.min.css"
  ctx-name="my-uploader"
>
</lr-file-uploader-regular>
```

3. Configure Uploadcare Blocks and add your personal public key to the project. Discover the instructions in the [following section](#configuration).

### From NPM

1. Install Uploadcare Blocks package: `npm i --save-exact @uploadcare/blocks`
2. Connect `Blocks` from your script file:

```js
import * as LR from '@uploadcare/blocks';

LR.registerBlocks(LR);
```

3. Start using Uploadcare Blocks in your application markup and replace `{{PACKAGE_VERSION}}` with the [latest version](https://github.com/uploadcare/blocks/releases) of the package:

```html
<lr-file-uploader-inline
  css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/lr-file-uploader-inline.min.css"
  ctx-name="my-uploader"
>
</lr-file-uploader-inline>
```

4. Configure Uploadcare Blocks and add your personal public key to the project. Discover the instructions in the [following section](#configuration).

### Configuration

All configurations in Uploadcare Blocks are managed from `lr-config` block.

1. Sign up to [Uploadcare](https://app.uploadcare.com/accounts/signup/?ref=github-readme).
2. Get a Public API key in [Uploadcare project's dashboard](https://app.uploadcare.com/projects/-/api-keys/?ref=github-readme).
3. Add a `lr-config` block to your markup and replace `YOUR_PUBLIC_KEY` with your own public key:

```html
<lr-config ctx-name="my-uploader" pubkey="YOUR_PUBLIC_KEY"></lr-config>
```

4. Make sure that your config block uses the same `ctx-name` attribute value as your solution block.

Discover more about Uploadcare Blocks configuration in [our documentation](https://uploadcare.com/docs/file-uploader/configuration/?ref=github-readme).

### Deep dive in Uploadcare Blocks 🛠

Follow our [step-by-step installation guide](https://uploadcare.com/docs/file-uploader/installation/?ref=github-readme) to launch Uploadcare Blocks in a few minutes and set it up based on your needs.

## Browser support

Latest desktop and mobile stable versions of Chrome, Edge, Firefox, Opera, and Safari are supported.

Internet Explorer is outdated and [not supported anymore](https://uploadcare.com/blog/uploadcare-stops-internet-explorer-support/?ref=github-readme).

## Framework support

_Uploadcare Blocks_ is a framework-agnostic solution, so you can use it with **any** runtime you like. Discover the integration examples:
<br/>

- [React](https://github.com/uploadcare/uc-blocks-examples/tree/main/examples/react-uploader)
- [Vue](https://github.com/uploadcare/uc-blocks-examples/tree/main/examples/vue-uploader)
- [Angular](https://github.com/uploadcare/uc-blocks-examples/tree/main/examples/angular-uploader)
- [Svelte](https://github.com/uploadcare/uc-blocks-examples/tree/main/examples/svelte-uploader)

All the source code is accessible and works in raw mode. Use _developer tools_ to dive into details.

## Contribution

You’re always welcome to contribute:

- Create [issues](https://github.com/uploadcare/blocks/issues) every time you feel something is missing or goes wrong.
- Provide your feedback or drop us a support request at <a href="mailto:hello@uploadcare.com">hello@uploadcare.com</a>.
- Ask questions on [Stack Overflow](https://stackoverflow.com/questions/tagged/uploadcare) with "uploadcare" tag if others can have these questions as well.
- Fork project, make changes and send it as pull request. For launching the developing mode follow these commands:
  - Install dependencies: `npm install`.
  - Start local dev-server: `npm run dev`.
- Star this repo if you like it ⭐️
