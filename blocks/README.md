# &lt;uc-blocks&gt;

## 🧩 Use predefined custom elements to build your own file uploading flow

> Or dive deeper and create your own beautiful blocks!

## 🍰 Concept description

There are so many use cases and many workflows for file uploading.
Is it possible to create an uploading solution to fit them all?

We believe it is — with the power of [Custom Elements standard](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements) and our widget-purpose-specific open-source [Symbiote.js](https://github.com/symbiotejs/symbiote.js) library.

You can use high-level, simple HTML and CSS to customize layouts and define the most popular scenarios.
You can create your own blocks from scratch with JavaScript using our super-duper [BlockComponent base-class](../docs/block-component/).

Key features:

- Easy to use within any modern toolchain: framework, library, or CMS.
- Lifecycle is controlled from the inside; you don't need to manage it in your code.
- You can easily switch between encapsulated secure styling and common document styles.
- Using of [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM) — is up to you.
- It's easy to set any customized data context for the blocks, to control them in detail.
- Total flexibility.
- No heavy dependencies and no bandwidth- and performance-penalizing libraries are necessary.
- It's easy to follow your strict design guidelines.
- Everything is very close to the native browser APIs and concepts; you don't need to learn something completely new.
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) friendly — good for secure enterprise usage.
- [Jamstack](https://jamstack.org/) friendly: enter the new world of web development!

<re-htm src="../assets/htm/upload-blocks-demo.htm"></re-htm>

## 🏠 Integration basics

We use the [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements) standard to make integration seamless.
That allows us to use simple HTML code to define layouts and place our widgets into other templates or other markups. Custom Elements are compatible with most modern technologies and provide a consistent workflow. Please, check out the list of high-level tests passed with a set of modern frontend frameworks and libraries: [Custom Elements Everywhere](https://custom-elements-everywhere.com/)

We also provide a set of [reference integrations](https://github.com/uploadcare/upload-blocks-examples).

## 🍱 Uploader solutions out of the box

We provide [the set of uploader builds](../solutions/file-uploader/) you can use for the most frequent cases or for references if you need to create your own.

## 🚀 Create your own file uploader

The standard flow of the uploading widget creation is following:

1. Install uc-blocks package: `npm i @uploadcare/uc-blocks`.
2. Create the set of all components you need (example: [index.js](../solutions/file-uploader/regular/index.js)).
3. Create your widget class with desired layout (example: [index.js](../solutions/file-uploader/regular/index.jss)).
4. Create CSS configuration file (example: [index.css](../solutions/file-uploader/regular/index.css)).
5. Place resulting custom HTML-tag into your application markup and connect CSS.

As you can see, that's quite simple.

> You should obtain a Public API Key in your [Uploadcare project's dashboard](https://app.uploadcare.com/) to use file uploading features.

## 🎨 Customize everything!

First of all, please look at [our CSS approach discussion](https://github.com/uploadcare/uc-blocks/discussions/18).
Please don't hesitate to take part; your opinion is very important to us.

### Look & feel

Each block has a reference CSS file located in a directory and a JavaScript class definition module.
You can use it as the template to create your own custom styling (or CSS animations) for any library block.
All blocks and their children act like regular DOM elements; therefore, you can use native CSS selectors and any existing styling approach.
All significant component states are provided as element attribute flags, so you can use the full power of CSS to customize the blocks deeply.

[More about CSS theme creation](./themes/uc-basic/)

### Layout & composition

Block components can be used separately or in combinations.
You can combine them to create a common workflow like this one:

```html
<uc-simple-btn></uc-simple-btn>

<uc-modal strokes>
  <uc-activity-icon slot="heading"></uc-activity-icon>
  <uc-activity-caption slot="heading"></uc-activity-caption>
  <uc-start-from>
    <uc-source-list wrap></uc-source-list>
    <uc-drop-area></uc-drop-area>
  </uc-start-from>
  <uc-upload-list></uc-upload-list>
  <uc-camera-source></uc-camera-source>
  <uc-url-source></uc-url-source>
  <uc-external-source></uc-external-source>
  <uc-upload-details></uc-upload-details>
  <uc-confirmation-dialog></uc-confirmation-dialog>
</uc-modal>

<uc-message-box></uc-message-box>
<uc-progress-bar-common></uc-progress-bar-common>
```

### Block templates

You can quickly override any block template by setting the new `template` property value to any block class. Here is an example:

```js
import { UC } from '@uploadcare/uc-blocks';

UC.ProgressBarCommon.template = /*html*/ `
  <h1>My custom heading</h1>
  <div class="my-custom-class">
    My custom template
  </div>
`;
```

All elements created by upload-blocks are discoverable via developer tools in your browser, so it's easy to find out what exactly you should edit to achieve the proper result. You don't need to install any specific tool to do that.

### Custom blocks

You can create your own custom upload-blocks to handle some specific use cases. You need to use the [Block](../abstract/) JavaScript base class to do that.

## ⚙️ More in depth

- [Configuration](../docs/configuration/)
- [Texts & localization](../docs/texts/)
- [Icons](../docs/icons/)
- [Styling](../docs/styling/)
- [Blocks](../docs/blocks/)
- [Contexts](../docs/contexts/)
- [Activities](../docs/activities/)
- [TypeScript](../docs/typescript/)
- [Symbiote.js](https://github.com/symbiotejs/symbiote.js)

## 💬 Discussions

If you have questions, ideas, usage feedback, or would like to suggest any other topic, feel free to join our [GitHub Discussions](https://github.com/uploadcare/jsdk/discussions/categories/upload-blocks)!

## ⚠️ Issues

Found a problem? Create an [issue](https://github.com/uploadcare/jsdk/issues)!
