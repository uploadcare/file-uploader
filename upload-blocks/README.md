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
* No any performance-expensive libraries or heavy dependencies needed
* So you have a strict design guides... not a problem anymore!
* Everything is very close to native browser API's and concepts, you don't need to learn something compleatly new
* [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) friendly - good for secure enterprise usage
* [Jamstack](https://jamstack.org/) friendly: enter the new world of web-development!


<re-htm src="../re-assets/htm/upload-blocks-demo.htm"></re-htm>


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
Some of widget settings in this example are passed via CSS variables. That means you can use styles, CSS-classes and dedicated CSS-files to pass any setting to any block or redefine if using native DOM API or just native HTML. Let's move forvard to the next section, to explain that.

## 🎨 Customize everything! 
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
## 📤 Data output

```html
<uc-data-output
  console
  fire-events
  from="*dataOutput"
  item-template="">
<uc-data-output>
```

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

