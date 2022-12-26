# Advanced customization: build your own uploading flow

If our pre-built [uploader solution](/solutions/file-uploader/) isn't enough for you, meet our highly customizable blocks.

## Blocks list

- [ActivityCaption](/blocks/ActivityCaption/) — shows heading text for the current activity
- [ActivityIcon](/blocks/ActivityIcon/) — shows actual icon for the current activity
- [CameraSource](/blocks/CameraSource/) — getting image for upload from the device camera
- [CloudImageEditor](/blocks/CloudImageEditor/) — image editing via Uploadcare cloud functions
- [Color](/blocks/Color/) — simple wrapper for the native color selector in browser
- [ComfirmationDialog](/blocks/ConfirmationDialog/) — user confirmations for the most sensitive actions
- [DataOutput](/blocks/DataOutput/) — dedicated element for the upload data extraction in host application
- [DropArea](/blocks/DropArea/) — wrapper element for the the drag-n-drop feature adding
- [EditableCanvas](/blocks/EditableCanvas/) — minimalistic in-browser image editing
- [FilePreview](/blocks/FilePreview/) — show file preview
- [ExternalSource](/blocks/ExternalSource/) — common wrapper for external file sources
- [FileItem](/blocks/FileItem/) — basic UI for the each uploading file entry
- [Icon](/blocks/Icon/) — displays an icon
- [Img](/blocks/Img/) — adaptive image
- [MessageBox](/blocks/MessageBox/) — common container for the application messages
- [Modal](/blocks/Modal/) — common pop-up window
- [ProgressBar](/blocks/ProgressBar/) — abstract progress bar
- [ProgressBarCommon](/blocks/ProgressBarCommon/) — displays uploading progress for the all files selected
- [Range](/blocks/Range/) — customizable wrapper for the range input element
- [Select](/blocks/Select/) — customizable selector
- [ShadowWrapper](/blocks/ShadowWrapper/) — Shadow DOM wrapper to encapsulate your solution
- [SimpleBtn](/blocks/SimpleBtn/) — button for the file uploading workflow start
- [SourceBtn](/blocks/SourceBtn/) — button for the certain source activation
- [SourceList](/blocks/SourceList/) — renders the list of file sources basing on configuration provided
- [StartFrom](/blocks/StartFrom/) — wrapper element for the uploading workflow initiation
- [Tabs](/blocks/Tabs/) — implements tabbing UI
- [UploadDetails](/blocks/UploadDetails/) — displays file details and adittional features
- [UploadList](/blocks/UploadList/) — shows the list of uploads
- [UrlSource](/blocks/UrlSource/) — file uploading from the external URL
- [Video](/blocks/Video/) — wrapper element for the browser video tag

## 🍰 Concept description

There are so many use cases and many workflows for file uploading.
Is it possible to create an uploading solution to fit them all?

We believe it is — with the power of [Custom Elements standard](https://developer.mozilla.org/en-US/docs/Web/Web_solutions/Using_custom_elements) and our widget-purpose-specific open-source [Symbiote.js](https://github.com/symbiotejs/symbiote.js) library.

You can use high-level, simple HTML and CSS to customize layouts and define the most popular scenarios.
You can create your own blocks from scratch with JavaScript using [BlockComponent base-class](https://github.com/uploadcare/blocks/blob/main/docs/block-component/index.htm).

### Key features

- Easy to use within any modern toolchain: framework, library, or CMS.
- The lifecycle is controlled from the inside; you don't need to manage it in your code.
- You can easily switch between encapsulated secure styling and common document styles.
- Using [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_solutions/Using_shadow_DOM) is up to you.
- Easy to set any customized data context for the blocks to control them in detail.
- Total flexibility.
- No heavy dependencies and no excessive bandwidth usage.
- Easy to follow the most strict design guidelines.
- Everything is very close to the native browser APIs and concepts; you don't need to learn something completely new.
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) friendly — great for a secure enterprise usage.
- [Jamstack](https://jamstack.org/) friendly: enter the new world of web development!

<re-htm src="../assets/htm/blocks-demo.htm"></re-htm>

## 🏠 Integration basics

We use the [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_solutions/Using_custom_elements) standard to make integration seamless.

That allows us to use simple HTML code to define layouts and place our widgets into other templates or other markups. Custom Elements are compatible with most modern technologies and provide a consistent workflow. Please, check out the list of high-level tests passed with a set of modern frontend frameworks and libraries: [Custom Elements Everywhere](https://custom-elements-everywhere.com/)

We also provide a set of [reference integrations](https://github.com/uploadcare/blocks-examples).

## 🚀 Create your own file uploader

The standard flow of the uploading widget creation is following:

1. Install lr-blocks package: `npm i @uploadcare/blocks`.
2. Create the set of all components you need.

```js
import * as LR from '@uploadcare/blocks';

LR.registerBlocks(LR);

class Uploader extends LR.FileUploaderRegular {}
Uploader.reg('uploader');
```

3. Create your widget class with desired layout.

```js
import * as LR from '@uploadcare/blocks';

LR.registerBlocks(LR);

class Uploader extends LR.FileUploaderRegular {}
Uploader.reg('uploader');
```

4. Create CSS configuration file.

```css
@import url('@uploadcare/blocks/blocks/themes/lr-basic/index.css');
```

5. Place resulting custom HTML-tag into your application markup and connect CSS.

As you can see, that's quite simple.

> You should get a Public API key in [Uploadcare project's dashboard](https://app.uploadcare.com/projects/-/api-keys/) to use file uploading features.

## 🎨 Customize everything!

First, please look at [our CSS approach discussion](https://github.com/uploadcare/blocks/discussions/18). Please don't hesitate to take part; your opinion is very important to us.

### Look & feel

Each block has a reference CSS file located in a directory and a JavaScript class definition module. You can use it as the template to create your own custom styling (or CSS animations) for any library block. All blocks and their children act like regular DOM elements; therefore, you can use native CSS selectors and any existing styling approach. All significant component states are provided as element attribute flags, so you can use the full power of CSS to customize the blocks deeply.

Lear more about [CSS theme creation](/blocks/themes/lr-basic/).

### Layout & composition

Block components can be used separately or in combinations. You can combine them to create a common workflow like this one:

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

LR.ProgressBarCommon.template = /* HTML */ `
  <h1>My custom heading</h1>
  <div class="my-custom-class">My custom template</div>
`;
```

All elements created by blocks are discoverable via developer tools in your browser. It's easy to find out what exactly you should edit to achieve the proper result. You don't need to install any specific tool to do that.

### Custom blocks

You can create your own custom blocks to handle some specific use cases. You need to use the Block JavaScript base class to do that.

## ⚙️ More in depth

- [Configuration](/get-started/configuration/)
- [Upload data output](/docs/output/)
- [Texts & localization](/get-started/localization/)
- [Styling](/blocks/themes/lr-basic/)
- [Activities](/docs/activities/)
- [TypeScript](/docs/typescript/)
- [Symbiote.js](https://github.com/symbiotejs/symbiote.js)

## 💬 Discussions

If you have questions, ideas, usage feedback, or would like to suggest any other topic, feel free to join our [GitHub Discussions](https://github.com/uploadcare/blocks/discussions/categories/blocks)!

## ⚠️ Issues

Found a problem? Create an [issue](https://github.com/uploadcare/blocks/issues).
