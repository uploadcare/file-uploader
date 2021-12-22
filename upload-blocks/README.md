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

We use [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements) standard to make integration seamless. That allows us to use simple HTML-code to define layouts and place our widgets into the any other templates or markup. Custom Elements are compatible with a most of modern technologies and providing the uniform workflow for all of them. Please, check out the list of a high level tests passed with a set of modern frontend frameworks and libraries: [Custom Elements Everywhere](https://custom-elements-everywhere.com/)

Also, we providing the set of [reference integrations](https://github.com/uploadcare/upload-blocks-examples).

To integrate Uploadcare widget, first of all, you should connect our script:
```html
<script 
  src="../upload-blocks/DefaultWidget/DefaultWidget.js"
  type="module">
</script>
```

You can use `npm` to install upload-blocks into your project:

`npm install ...`

Basic integration HTML-code example:
```html
<uc-default-widget
  css-src="../upload-blocks/themes/uc-basic/index.css">
</uc-default-widget>
```
As you can see, it's very simple.

> You shold obtain a Public API Key in your [Uploadcare project's dashboard](https://app.uploadcare.com/) to use file uploading features. 

For demo-only purposes you can use `demopublickey` instead:
```html
<uc-default-widget
  style="--pubkey:'demopublickey'; --darkmode: 1"
  css-src="../upload-blocks/themes/uc-basic/index.css">
</uc-default-widget>
```
Some of widget settings in this example are passed via CSS variables. That means you can use styles, CSS-classes and dedicated CSS-files to pass any setting to any block or redefine if using native DOM API or just native HTML syntax. Let's move forvard to the next section, to explain that.

## 🎨 Customize everything!

First of all, please take a look at [our CSS aproach discussion](https://github.com/uploadcare/jsdk/discussions/18). Don't be shy to participate, your opinion is very important for us.

### Basic configuration

All basic configurations for each block could be provided via the set of [CSS-variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties):
```css
.uc-wgt-cfg, .uc-wgt-common, :host {
  --ctx-name: 'my-uploader';
  --cfg-pubkey: 'demopublickey';
  --cfg-multiple: 1;
  --cfg-confirm-upload: 1;
  --cfg-img-only: 0;
  --cfg-accept: '';
  --cfg-store: 1;
  --cfg-camera-mirror: 1;
  --cfg-source-list: 'local, url, camera, dropbox, gdrive, facebook';
  --cfg-max-files: 10;
  --cfg-max-local-file-size-bytes: 30000;
  --cfg-thumb-size: 76;
  --cfg-show-empty-list: 0;
  --cfg-use-local-image-editor: 0;
  --cfg-use-cloud-image-editor: 0;
}
```
Variable value should be a correct JSON value. Strings shoud be taken in quotes. We use the `1` or `0` numbers to define boolean flags.

Any configuration value can be defined and redefined at any level of the DOM tree, at any time.

### Look & feel

Each block has a reference CSS file, placed at the common directory with the JavaScript class defenition module. You can use it as the template to create your onw custom styling (or CSS-animations) for the any library block. All blocks and their children are acting like a regular DOM-elements in that case, you can use native CSS-selectors and the any of the well known styling approaches. All significant component states are provided as the element attribute flags, so you can use the full power of CSS to customize blocks in deep.

[More about CSS theme creation]()

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

## 📤 Data output

We providing the dedicated block for the data output purposes - `<uc-data-output>`. 
This is a Custom Element which can be connected to some workflow context and provide you the convenient data access.

Here is the code example:

```html
<uc-data-output
  console
  fire-events
  from="*dataOutput"
  item-template="<img src='https://ucarecdn.com/{{uuid}}/-/preview/' />">
<uc-data-output>
```
Let's walk through its attributes:

* `console` - this flag lets you enable browser console output without modifing the source code.
* `fire-events` - this flag enables custom events (`data-output`) dispatching for the DOM-element. These events are containig all uploading data and could be processed at the any level of your application
* `from` - data output could be connected to any field in the workflow context. You can specify the certain one. By default it is a `*dataOutput`, you can skip this setting for the default uploading case
* `item-template` - uploading resuls cold be rendered as a list of nested DOM-elements. You can specify simple template for that.
* `form-value` - could be used to handle HTML-forms

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



