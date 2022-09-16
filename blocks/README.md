# Advanced customization: build your own uploading flow

If our pre-built <a href="/components/file-uploader/">uploader solution</a> isn't enough for you, meet our highly customizable blocks.

## Blocks list:

- [ActivityCaption](./ActivityCaption/) - shows heading text for the current activity
- [ActivityIcon](./ActivityIcon/) - shows actual icon for the current activity
- [CameraSource](./CameraSource/) - getting image for upload from the device camera
- [CloudImageEditor](./CloudImageEditor/) - image editing via Uploadcare cloud functions
- [Color](./Color/) - simple wrapper for the native color selector in browser
- [ComfirmationDialog](./ConfirmationDialog/) - user confirmations for the most sensitive actions
- [DataOutput](./DataOutput/) - dedicated element for the upload data extraction in host application
- [DropArea](./DropArea/) - wrapper element for the the drag-n-drop feature adding
- [EditableCanvas](./EditableCanvas/) - minimalistic in-browser image editing
- [ExternalSource](./ExternalSource/) - common wrapper for external file sources
- [FileItem](./FileItem/) - basic UI for the each uploading file entry
- [Icon](./Icon/) - displays an icon
- [Img](./Img/) - adaptive image
- [MessageBox](./MessageBox/) - common container for the application messages
- [Modal](./Modal/) - common pop-up window
- [ProgressBar](./ProgressBar/) - abstract progress bar
- [ProgressBarCommon](./ProgressBarCommon/) - displays uploading progress for the all files selected
- [Range](./Range/) - customizable wrapper for the range input element
- [Select](./Select/) - customizable selector
- [ShadowWrapper](./ShadowWrapper/) - Shadow DOM wrapper to encapsulate your solution
- [SimpleBtn](./SimpleBtn/) - button for the file uploading workflow start
- [SourceBtn](./SourceBtn/) - button for the certain source activation
- [SourceList](./SourceList/) - renders the list of file sources basing on configuration provided
- [StartFrom](./StartFrom/) - wrapper element for the uploading workflow initiation
- [Tabs](./Tabs/) - implements tabbing UI
- [UploadDetails](./UploadDetails/) - displays file details and adittional features
- [UploadList](./UploadList/) - shows the list of uploads
- [UrlSource](./UrlSource/) - file uploading from the external URL
- [Video](./Video/) - wrapper element for the browser video tag

## 🍰 Concept description

There are so many use cases and many workflows for file uploading.
Is it possible to create an uploading solution to fit them all?

We believe it is — with the power of <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements">Custom Elements standard</a> and our widget-purpose-specific open-source <a target="_blank" href="https://github.com/symbiotejs/symbiote.js">Symbiote.js</a> library.

You can use high-level, simple HTML and CSS to customize layouts and define the most popular scenarios.
You can create your own blocks from scratch with JavaScript using our super-duper <a target="_blank" href="https://github.com/uploadcare/blocks/blob/main/docs/block-component/index.htm">BlockComponent base-class</a>.

### Key features:

- Easy to use within any modern toolchain: framework, library, or CMS.
- The lifecycle is controlled from the inside; you don't need to manage it in your code.
- You can easily switch between encapsulated secure styling and common document styles.
- Using <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM">Shadow DOM</a> — is up to you.
- It's easy to set any customized data context for the blocks to control them in detail.
- Total flexibility.
- No heavy dependencies and no bandwidth - and performance-penalizing libraries are necessary.
- It's easy to follow your strict design guidelines.
- Everything is very close to the native browser APIs and concepts; you don't need to learn something completely new.
- <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP">Content Security Policy (CSP)</a> friendly — good for secure enterprise usage.
- <a target="_blank" href="https://jamstack.org/">Jamstack</a> friendly: enter the new world of web development!

<re-htm src="../assets/htm/upload-blocks-demo.htm"></re-htm>

## 🏠 Integration basics

We use the <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements">Custom Elements</a> standard to make integration seamless.
That allows us to use simple HTML code to define layouts and place our widgets into other templates or other markups. Custom Elements are compatible with most modern technologies and provide a consistent workflow. Please, check out the list of high-level tests passed with a set of modern frontend frameworks and libraries: <a target="_blank" href="https://custom-elements-everywhere.com/">Custom Elements Everywhere</a>

We also provide a set of <a target="_blank" href="https://github.com/uploadcare/upload-blocks-examples">reference integrations</a>.

## 🚀 Create your own file uploader

The standard flow of the uploading widget creation is following:

1. Install lr-blocks package: `npm i @uploadcare/blocks`.
2. Create the set of all components you need.

```js
import * as LR from '../../../index.js';

LR.registerBlocks(LR);

class Uploader extends LR.FileUploaderRegular {}
Uploader.reg('uploader');
```

3. Create your widget class with desired layout.

```js
import * as LR from '../../../index.js';

LR.registerBlocks(LR);

class Uploader extends LR.FileUploaderRegular {}
Uploader.reg('uploader');
```

4. Create CSS configuration file.

```css
@import url('../../../blocks/themes/lr-basic/index.css');
```

6. Place resulting custom HTML-tag into your application markup and connect CSS.

As you can see, that's quite simple.

> You should obtain a Public API Key in your <a target="_blank" href="https://app.uploadcare.com/">Uploadcare project's dashboard</a> to use file uploading features.

## 🎨 Customize everything!

First, please look at <a target="_blank" href="https://github.com/uploadcare/blocks/discussions/18">our CSS approach discussion</a>.
Please don't hesitate to take part; your opinion is very important to us.

### Look & feel

Each block has a reference CSS file located in a directory and a JavaScript class definition module.
You can use it as the template to create your own custom styling (or CSS animations) for any library block.
All blocks and their children act like regular DOM elements; therefore, you can use native CSS selectors and any existing styling approach.
All significant component states are provided as element attribute flags, so you can use the full power of CSS to customize the blocks deeply.

[More about CSS theme creation](./themes/lr-basic/)

### Layout & composition

Block components can be used separately or in combinations.
You can combine them to create a common workflow like this one:

```html
<lr-simple-btn></lr-simple-btn>

<lr-modal strokes>
  <lr-activity-icon slot="heading"></lr-activity-icon>
  <lr-activity-caption slot="heading"></lr-activity-caption>
  <lr-start-from>
    <lr-source-list wrap></lr-source-list>
    <lr-drop-area></lr-drop-area>
  </lr-start-from>
  <lr-upload-list></lr-upload-list>
  <lr-camera-source></lr-camera-source>
  <lr-url-source></lr-url-source>
  <lr-external-source></lr-external-source>
  <lr-upload-details></lr-upload-details>
  <lr-confirmation-dialog></lr-confirmation-dialog>
  <lr-cloud-image-editor></lr-cloud-image-editor>
</lr-modal>

<lr-message-box></lr-message-box>
<lr-progress-bar-common></lr-progress-bar-common>
```

### Block templates

You can quickly override any block template by setting the new `template` property value to any block class. Here is an example:

```js
import * as LR from '@uploadcare/blocks';

LR.ProgressBarCommon.template = /*html*/ `
  <h1>My custom heading</h1>
  <div class="my-custom-class">
    My custom template
  </div>
`;
```

All elements created by upload-blocks are discoverable via developer tools in your browser, so it's easy to find out what exactly you should edit to achieve the proper result. You don't need to install any specific tool to do that.

### Custom blocks

You can create your own custom upload-blocks to handle some specific use cases. You need to use the Block JavaScript base class to do that.

## ⚙️ More in depth

- [Configuration](../get-started/configuration/)
- [Upload data output](../docs/output/)
- [Texts & localization](../get-started/localization/)
- [Styling](../blocks/themes/lr-basic/)
- [Activities](../docs/activities/)
- [TypeScript](../docs/typescript/)
- <a target="_blank" href="https://github.com/symbiotejs/symbiote.js">Symbiote.js</a>

## 💬 Discussions

If you have questions, ideas, usage feedback, or would like to suggest any other topic, feel free to join our <a target="_blank" href="https://github.com/uploadcare/jsdk/discussions/categories/upload-blocks">GitHub Discussions</a>!

## ⚠️ Issues

Found a problem? Create an <a href="https://github.com/uploadcare/jsdk/issues" target="_blank">issue</a>!
