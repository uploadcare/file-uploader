# uc-uploader

You can use a custom uploader:
* [Regular case](./regular/)
* [Inline case](./inline/)
* [Simplified case](./simplified/)

All content fully accessible at https://uploadcare.github.io/jsdk/.

## Features
* JS size. The total amount of JavaScript code in web applications has become smaller.
* Minimum of external dependencies. We don't use JS libraries as jQuery anymore.
* Modern web standards compatibility. We are use Shadow DOM or CSP in the integration environment.
* Build stage is not necessary for development. Use the code directly in any modern browser or Node.js.
* Close to native web platform as possible. We don't force you to use any specific development environment tools.

## Supported browsers
Uploader is supported and tested in all major modern desktop and mobile browsers:

* Chrome
* Firefox
* Safari
* Edge
* Opera
* etc

[Internet Explorer](https://uploadcare.com/blog/uploadcare-stops-internet-explorer-support/) is outdated and not supported anymore.

## Quick start
### Public Key
Obtain a Public API Key in your Uploadcare project's dashboard to use file uploading features. 
For demo-only purposes you can use demopublickey instead.

### Integrate
To integrate Uploadcare widget, first of all, you should connect our script:
```html
<head>

  <script 
    type="module"
    src="https://re4ma.github.io/re4ma.js/render/render.js">
  </script>

</head>
```

You can use npm to install upload-blocks into your project:
```html
npm install @uploadcare/upload-blocks

import { registerBlocks } from '../../upload-blocks/registerBlocks.js';
```

Basic integration HTML-code example:
```html
<uc-default-widget
  link rel="stylesheet" href="../../doc_assets/css/doc.css">
</uc-default-widget>
```

### Example
For demo-only purposes you can use demopublickey instead:

```html
<uc-default-widget
  style="--pubkey:'demopublickey'"
  css-src="../upload-blocks/themes/uc-basic/index.css">
</uc-default-widget>
```

Widget settings in this example are passed via CSS variables. 
That means you can use styles, CSS-classes and dedicated CSS-files 
to pass any setting to any block or redefine if using native DOM API 
or just native HTML syntax. 

## Configure
Configuration is specified in CSS. 
Learn more [here](https://github.com/uploadcare/jsdk/discussions/18).
For example:

```
?
```

Variables are used in the example:
* --ctx-name —
* --cfg-pubkey — you project public key, found in Dashboard
* --cfg-multiple  — allow uploading multiple files
* --cfg-confirm-upload  —
* --cfg-img-only  — allow only images to be uploaded
* --cfg-accept  —
* --cfg-store  — storing behaviour
* --cfg-camera-mirror  - 
* --cfg-source-list  — list of uploading sources being rendered by uploading widget
* --cfg-max-files  — maximum amount of files allowed to be uploaded at once


## Upload Sources
Upload Blocks supports 14 upload sources, including cloud services and social networks:
* Local file storage
* Web-camera
* External URL
* Gdrive
* Dropbox
* Onedrive
* Huddle 
* Box
* Instagram
* Vk
* Facebook
* Flickr
* Gphotos
* Evernote

You can configure the set of upload sources and choose the ones you need.

## Text customization

Localization is a part of the configuration process. The default is an English locale. 
If a string item is missing in a locale you created or customized, English will be a fallback.

## Icon customization
...
