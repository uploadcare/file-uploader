# &lt;upload-blocks&gt;

## 🧩 Bulld you own file uploading flow with the set of pre-defined custom elements!

> Or dive deeper and create your own beautiful blocks!

## 🍰 Concept description

There are so many use cases and many workflows for file uploading... Is it possible to create uploading solution to fit them all? 

We believe - yes, with a power of [Custom Elements standard](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements) and our widget-purpose-specific open source [Symbiote.js](https://github.com/symbiotejs/symbiote.js) library.

You can use high-level simple HTML and CSS to customize layouts and define the most popular scenarios. You can create your onw blocks from scratch with JavaScript using our super-duper [BlockComponent base-class](./docs/block-component.html).

Key features:

* Easy to use within any modern toolchain: framework, library or CMS
* Livecycle is controlled from inside, you don't need to manage it in your code
* You can easyly switch between encapsulated secure styling and common document styles. 
* Using of [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM) - is up to you
* Very easy to set any customized data context for the blocks, to controll them in details
* Total flexibility
* No any expensive for the bandwidth and performance libraries or other heavy dependencies are needed
* So you have a strict design guides... it's not a problem anymore!
* Everything is very close to the native browser API's and concepts, you don't need to learn something compleatly new
* [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) friendly - good for secure enterprise usage
* [Jamstack](https://jamstack.org/) friendly: enter the new world of web-development!

<re-htm src="./doc_assets/upload-blocks-demo.htm"></re-htm>

## 🏠 Integration basics

We use [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements) standard to make integration seamless. That allows us to use simple HTML-code to define layouts and place our widgets into the any other templates or other markup. Custom Elements are compatible with a most of modern technologies and providing the uniform workflow for all of them. Please, check out the list of a high level tests passed with a set of modern frontend frameworks and libraries: [Custom Elements Everywhere](https://custom-elements-everywhere.com/)

Also, we providing the set of [reference integrations](https://github.com/uploadcare/upload-blocks-examples).

## 🍱 Uploader solutions out of the box

We provide [the set of uploader builds](../uploader/) you can use for the most frequent cases or for the reference if you need to build your own.

## 🚀 Create your own file uploader

The common flow of the uploading widget creation is following:

1. Install upload-blocks: `npm i @uploadcare/upload-blocks`
2. Create the set of all components you need (example: [exports.js](../uploader/regular/exports.js))
3. Create your widget class with desired layout (example: [index.js](../uploader/regular/index.js))
4. Create CSS configuration file (example: [index.css](../uploader/regular/index.css))
5. Place resulting custom HTML-tag into your application markup and connect CSS ([example](./doc_assets/basic-demo.snpt.html))

As you can see, that's quite simple.

> You shold obtain a Public API Key in your [Uploadcare project's dashboard](https://app.uploadcare.com/) to use file uploading features. 

## 🎨 Customize everything!

First of all, please take a look at [our CSS aproach discussion](https://github.com/uploadcare/jsdk/discussions/18). Don't be shy to participate, your opinion is very important for us.

### Look & feel

Each block has a reference CSS file, placed at the common directory with the JavaScript class defenition module. You can use it as the template to create your onw custom styling (or CSS-animations) for the any library block. All blocks and their children are acting like a regular DOM-elements in that case, you can use native CSS-selectors and the any of the well known styling approaches. All significant component states are provided as the element attribute flags, so you can use the full power of CSS to customize blocks in deep.

[More about CSS theme creation](./themes/uc-basic/)

### Layout & composition

Block-components can be used separately or in combinations. You can compose them into the common workflow:

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
<uc-progress-bar></uc-progress-bar>
```

### Block templates

You can redefine any block template with ease by setting the new `template` property value to any block class. Here is an example:

```js
import { UC } from '@uploadcare/upload-blocks';

UC.ProgressBar.template = /*html*/ `
  <h1>My custom heading</h1>
  <div class="my-custom-class">
    My custom template
  </div>
`;
```
All elements created by upload-blocks are discoverable via developer tools in your browser, so its easy to find out what exactly you should edit to achieve proper result. You don't need to install any specific tool to do that.

### Custom blocks

You can create your own custom upload-blocks to handle some specific use cases. You need to use [BlockComponent](./docs/block-component/) JavaScript base class, to do that.

## ⚙️ More in depth

* [Configuration](./docs/configuration/)
* [Texts & localization](./docs/texts/)
* [Icons](./docs/icons/)
* [Styling](./docs/styling/)
* [Blocks](./docs/blocks/)
* [Contexts](./docs/contexts/)
* [Activities](./docs/activities/)
* [TypeScript](./docs/typescript/)
* [Symbiote.js](https://github.com/symbiotejs/symbiote.js)

## 💬 Discussions

If you have a questions, any usage feedback, ideas or proposals, or you want to suggest any other topic - please, welcome to our [GitHub Discussions](https://github.com/uploadcare/jsdk/discussions/categories/upload-blocks)!

## ⚠️ Issues

Found a problem? Create an [issue](https://github.com/uploadcare/jsdk/issues)!



