<p align="center">
  <a href="https://uploadcare.com/?ref=github-readme">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/media/logo-safespace-transparent.svg">
      <source media="(prefers-color-scheme: light)" srcset="./assets/media/logo-safespace-black.svg">
      <img alt="Uploadcare logo" src="./assets/media/logo-safespace-transparent.svg">
    </picture>
  </a>
</p>

[Website](https://uploadcare.com?ref=github-readme) • [Getting Started](https://uploadcare.com/docs/start/quickstart?ref=github-readme) • [Docs](https://uploadcare.com/docs?ref=github-readme) • [Blog](https://uploadcare.com/blog?ref=github-readme) • [Discord](https://discord.gg/mKWRgRsVz8?ref=github-readme) • [Twitter](https://twitter.com/Uploadcare?ref=github-readme)

[![npm version](https://badge.fury.io/js/@uploadcare%2Fblocks.svg)](https://www.npmjs.com/package/@uploadcare/blocks)
[![GitHub Actions](https://github.com/uploadcare/blocks/workflows/checks/badge.svg)](https://github.com/cube-js/cube/actions?query=workflow%3ABuild+branch%3Amaster)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

# 📦  Uploadcare Blocks: Stack-Agnostic Library for Uploading, Processing, and Editing Images On-the-Fly

`Uploadcare Blocks` is a powerful JavaScript library for creating custom file-handling services. `Blocks` include various interactive and customizable UI components to enhance users' file uploading and processing experience. As a bonus, you receive all the [Uploadcare's](https://uploadcare.com/) versatile file-handling capabilities, including [smart CDN](https://uploadcare.com/docs/delivery/cdn/#content-delivery-network), [MIME-type filtering](https://uploadcare.com/docs/moderation/#file-types), [signed uploads](https://uploadcare.com/docs/security/secure-uploads/), and [even more]((https://uploadcare.com/features/)). 

<img alt="Uploadcare Blocks examples" src="https://ucarecdn.com/8035cdc7-f0b9-4ea9-8c15-05816f315481/">

## Core Features

- [File Uploader](/solutions/file-uploader/) — implement file managing functionality with [multifunctional or minimal interfaces](https://uploadcare.com/docs/file-uploader/) in just a few minutes.
- [Advanced Customization](/blocks/) — create unique file-uploading interfaces by reorganizing pre-built components and styles with custom based on your needs.
- [Adaptive Images](/solutions/adaptive-image/) — build responsive user interfaces that adapt to various screen sizes and devices, ensuring a performant experience across platforms. 
- [Cloud Image Editor](/solutions/cloud-image-editor/) — edit, transform, and process images right from a browser on-the-fly.
- [Uploadcare power and features](https://uploadcare.com/features/) — upload, process, deliver, and manage images without building custom infrastructure.


- `Coming Soon!` Web Components for any media content management like audio, video, image galleries, and more.

## Why Blocks?
**Rapid Integration**

`Uploadcare Blocks` provide a ready-to-use set of UI components for file handling. It saves you valuable development time and effort, allowing you to focus on other core aspects of your application. You even don't need to build a stage while developing — just run the code directly from the browser or Node.js.

**Cross-Platform Compatibility**

`Uploadcare Blocks` are designed to work seamlessly across various platforms and frameworks. Whether you're building a web application using React, Vue.js, Angular, Svelte, or other frameworks, you get [integrations and support](https://uploadcare.com/docs/integrations/) for various development environments.

**Developer-Friendly**

`Uploadcare Blocks` come with modern technologies at your fingertips, like [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components), [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [WASM](https://webassembly.org/), [ESM-level](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) code sharing, and other cutting-edge web standards. `Uploadcare Blocks` is a native web platform with minimum external dependencies and a lightweight library providing a cheap security audit.

**Typescript support**

We use [JSDoc type annotations](https://www.typescriptlang.org/docs/handbook/intro-to-js-ts.html) for TypeScript static analysis support during development.  Additionally, we provide type definitions ([\*.d.ts files](https://www.typescriptlang.org/docs/handbook/declaration-files/dts-from-js.html)) for the TypeScript projects in our packages. Check the [JSDoc Reference](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html) page in TypeScript official documentation.

## 🚀 Getting Started

### HTML `<script>` Tag

* Connect `Blocks` directly from your document:

```html
<script src="https://unpkg.com/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/blocks-browser.min.js" type="module"></script>
```

* Start using `Blocks` in your application markup:

```html
<lr-file-uploader-regular
  css-src="https://unpkg.com/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/file-uploader-regular.min.css"
>
</lr-file-uploader-regular>
```

### Using CLI

You’ll need [Node.js](https://nodejs.org/) installed on your computer.

* Install Blocks package: `npm i --save-exact @uploadcare/blocks`
* Use `connectBlocksFrom` function to connect blocks:
```js
import { connectBlocksFrom } from '@uploadcare/blocks/abstract/connectBlocksFrom.js';

connectBlocksFrom('https://unpkg.com/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/blocks-browser.min.js');
```
* Start using `Blocks` in your application markup:
```html
<lr-file-uploader-inline
  css-src="https://unpkg.com/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/file-uploader-inline.min.css"
  class="my-config-class"
></lr-file-uploader-inline>
```

### Advanced mode

* Install Blocks package: `npm i @uploadcare/blocks`
* Start using blocks and build your own solutions from the source code:
```js
import * as LR from '@uploadcare/blocks';

LR.registerBlocks(LR);
```

### Using File Uploading Features

By default, `Blocks` use `demopublickey`, which you can save for demo purposes. To replace it with your own public key, sign up to [Uploadcare](https://app.uploadcare.com/accounts/signup/) and get a Public API key in [Uploadcare project's dashboard](https://app.uploadcare.com/projects/-/api-keys/). 

---
Follow our [step-by-step installation guide](/get-started/installation/) to launch `Uploadcare Blocks` just in a few minutes.

## Browser Support

Latest desktop and mobile stable versions of Chrome, Edge, Firefox, Opera, and Safari are supported. 

Internet Explorer is outdated and [not supported anymore](https://uploadcare.com/blog/uploadcare-stops-internet-explorer-support/).

## Framework Support

`Blocks` are a framework-agnostic solution, so you can use it with **any** runtime you like. Discover the integration examples:
<br/>

- [React](https://github.com/uploadcare/uc-blocks-examples/tree/main/examples/react-uploader)
- [Vue](https://github.com/uploadcare/uc-blocks-examples/tree/main/examples/vue-uploader)
- [Angular](https://github.com/uploadcare/uc-blocks-examples/tree/main/examples/angular-uploader)
- [Svelte](https://github.com/uploadcare/uc-blocks-examples/tree/main/examples/svelte-uploader)

All the source code is accessible and works in raw mode. Use `developer tools` to dive into details.

## Contribution

You’re always welcome to contribute:
* Create issues every time you feel something is missing or goes wrong.
* Provide your feedback or drop us a support request at <a href="mailto:hello@uploadcare.com">hello@uploadcare.com</a>.
* Ask questions on [Stack Overflow](https://stackoverflow.com/questions/tagged/uploadcare) with `uploadcare` tag if others can have these questions as well.
* Fork project, make changes and send it as pull request. For launching the developing mode follow these commands:
  * Install dependencies: `npm install`.
  * Start local dev-server: `npm run dev`.
