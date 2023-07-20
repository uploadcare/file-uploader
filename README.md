<p align="center">
  <a href="https://uploadcare.com/?ref=github-readme">
    <picture>
      <source media="(prefers-color-scheme: light)" srcset="./assets/media/logo-safespace-transparent.svg">
      <source media="(prefers-color-scheme: dark)" srcset="./assets/media/logo-transparent-inverted.svg">
      <img width=250 alt="Uploadcare logo" src="./assets/media/logo-safespace-transparent.svg">
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

# 📦 Uploadcare Blocks: Stack-Agnostic Library for Uploading, Processing, and Editing Images On-the-Fly


[![npm version](https://badge.fury.io/js/@uploadcare%2Fblocks.svg)](https://www.npmjs.com/package/@uploadcare/blocks)
[![GitHub Actions](https://github.com/uploadcare/blocks/workflows/checks/badge.svg)](https://github.com/uploadcare/blocks/actions?query=workflow%3ABuild+branch%3Amaster)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`Uploadcare Blocks` is a powerful JavaScript library for creating custom file-handling services. `Blocks` include various interactive and customizable UI components to enhance users' file uploading and processing experience. As a bonus, you receive all the [Uploadcare's](https://uploadcare.com/) versatile file-handling capabilities, including [smart CDN](https://uploadcare.com/docs/delivery/cdn/#content-delivery-network), [MIME-type filtering](https://uploadcare.com/docs/moderation/#file-types), [signed uploads](https://uploadcare.com/docs/security/secure-uploads/), and [even more]((https://uploadcare.com/features/)). 

See `Blocks` [in action](https://codesandbox.io/s/file-uploader-regular-demo-mm3znl?file=/index.html)!

<img alt="Uploadcare Blocks examples" src="https://ucarecdn.com/8035cdc7-f0b9-4ea9-8c15-05816f315481/">

## Core Features

* [File Uploader](/solutions/file-uploader/) — implement file managing functionality with [multifunctional or minimal interfaces](https://uploadcare.com/docs/file-uploader/) in just a few minutes.
* [Advanced Customization](/blocks/) — create unique file-uploading interfaces by reorganizing pre-built components and styles with custom based on your needs.
* [Adaptive Images](/solutions/adaptive-image/) — build responsive user interfaces that adapt to various screen sizes and devices, ensuring a performant experience across platforms. 
* [Cloud Image Editor](/solutions/cloud-image-editor/) — edit, transform, and process images right from a browser on-the-fly.
* [Uploadcare power and features](https://uploadcare.com/features/) — upload, process, deliver, and manage images without building custom infrastructure.
- `Coming Soon!` Web Components for any media content management like audio, video, image galleries, and more.

## Why Blocks?
### Rapid Integration

We provide a ready-to-use set of UI components for file handling. It saves you valuable development time and effort, allowing you to focus on other core aspects of your application. You even don't need to build a stage while developing — just run the code directly from the browser.

### Cross-Platform Compatibility

`Uploadcare Blocks` are designed to work seamlessly across various platforms and frameworks. Whether you're building a web application using React, Vue.js, Angular, Svelte, or other frameworks, you get [integrations and support](https://uploadcare.com/docs/integrations/) for various development environments.

### Developer-Friendly

The library comes with modern technologies at your fingertips, like [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components), [ESM-level](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) code sharing, and other cutting-edge web standards. `Uploadcare Blocks` is a native web platform with minimum external dependencies and a lightweight library providing a cheap security audit.

### Typescript support

We use [JSDoc type annotations](https://www.typescriptlang.org/docs/handbook/intro-to-js-ts.html) for TypeScript static analysis support during development.  Additionally, we provide type definitions ([\*.d.ts files](https://www.typescriptlang.org/docs/handbook/declaration-files/dts-from-js.html)) for the TypeScript projects in our packages.

## 🚀 Getting Started

### HTML `<script>` Tag

* Connect `Blocks` directly from your document replacing `{{PACKAGE_VERSION}}` with the [latest version](https://github.com/uploadcare/blocks/releases) of the package:

```html
<script type="module">
  import * as LR from 'https://cdn.jsdelivr.net/npm/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/blocks.min.js';
  
  LR.registerBlocks(LR);
</script>
```

* Start using `Blocks` in your application markup (don't forget to specify `{{PACKAGE_VERSION}}` with the [latest one](https://github.com/uploadcare/blocks/releases)):

```html
<lr-file-uploader-regular
  css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/file-uploader-regular.min.css"
  class="my-uploader"
>
</lr-file-uploader-regular>
```

* All configurations and customization in `Blocks` are managed from CSS code. Create a style sheet with the following code and replace `YOUR_PUBLIC_KEY` with your personal one (discover [how to obtain public keys](#using-file-uploading-features)):

```css
.my-uploader {
  --ctx-name: 'my-uploader';
  --cfg-pubkey: 'YOUR_PUBLIC_KEY';
}
```

### Using NPM

* Install Blocks package: `npm i --save-exact @uploadcare/blocks`
* Connect `Blocks` from your script file:
```js
import * as LR from '@uploadcare/blocks';

LR.registerBlocks(LR);
```
* Start using `Blocks` in your application markup and replace `{{PACKAGE_VERSION}}` with the [latest version](https://github.com/uploadcare/blocks/releases) of the package:
```html
<lr-file-uploader-inline
        css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/file-uploader-regular.min.css"
        class="my-uploader"
>
</lr-file-uploader-inline>
```

### Configuration

All configurations in `Blocks` are managed from CSS code. 
* Sign up to [Uploadcare](https://app.uploadcare.com/accounts/signup/).
* Get a Public API key in [Uploadcare project's dashboard](https://app.uploadcare.com/projects/-/api-keys/). 
* Add a style sheet to your project and replace `'YOUR_PUBLIC_KEY'` with your own public key:

```css
.my-uploader {
  --ctx-name: 'my-uploader';
  --cfg-pubkey: 'YOUR_PUBLIC_KEY';
}
```

Discover more about `Blocks` configuration in [our documentation](https://uploadcare.com/docs/file-uploader/configuration/).

### Deep Dive in Blocks 🛠
Follow our [step-by-step installation guide](https://uploadcare.com/docs/file-uploader/installation/) to launch `Uploadcare Blocks` in a few minutes and set it up based on your needs.

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
* Create [issues](https://github.com/uploadcare/blocks/issues) every time you feel something is missing or goes wrong.
* Provide your feedback or drop us a support request at <a href="mailto:hello@uploadcare.com">hello@uploadcare.com</a>.
* Ask questions on [Stack Overflow](https://stackoverflow.com/questions/tagged/uploadcare) with `uploadcare` tag if others can have these questions as well.
* Fork project, make changes and send it as pull request. For launching the developing mode follow these commands:
  * Install dependencies: `npm install`.
  * Start local dev-server: `npm run dev`.
