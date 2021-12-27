# uc-uploader

You can build a custom uploader that best suits your needs using Upload Blocks.
Upload Blocks are Lego for all your web app uploading needs. 
It is a highly customizable and extremely light JS library that works with any framework in any environment.

## Key features

File uploading:
* Add uploading widget to your web app (works with any framework in any environment).
* Upload files of any type and up to 5 TB in size, track their uploading progress.
* Multiple files and multipart uploads.
* Get files from various upload sources, including local storage, camera, social media, and cloud storage services.
* Shows image previews.

Customization:
* All customization and localization is done with CSS.
* Configure upload sources with HTML.
* Build your own custom-styles.css if you need to.

Security & compliance:
* Make your uploading system compatible with GDPR/CCPA, HIPAA, SOC2, and more.
* Prevent remote code execution through file uploading.
* Prevent code execution in uploaded files like SVG, html and xml.

Scalability & reliability: ??
* Speed up the uploading with the uploading network (it works like CDN).
* Utilize our robust infrastructure, forget about uploads support.
* 99.9% SLA for uploading API, 99.99% SLA for CDN.


### Libraries
We don't use JS libraries anymore:
* jQuery
* ...

### Supported browsers
Upload Blocks works in all modern browsers: desktop and mobile.
[Internet Explorer](https://uploadcare.com/blog/uploadcare-stops-internet-explorer-support/) isn’t supported.


## Quick start
### Public Key
Obtain a Public API Key in your Uploadcare project's dashboard to use file uploading features. 
For demo-only purposes you can use demopublickey instead.

### Integrate
To integrate Uploadcare widget, first of all, you should connect our script:
```html
<script 
  src="../upload-blocks/DefaultWidget/DefaultWidget.js"
  type="module">
</script>
```

You can use npm to install upload-blocks into your project:
```html
npm install @uploadcare/upload-blocks
import UploadBlocks from '@uploadcare/upload-blocks'
```

Basic integration HTML-code example:
```html
<uc-default-widget
  css-src="../upload-blocks/themes/uc-basic/index.css">
</uc-default-widget>
```

### Example
For demo-only purposes you can use demopublickey instead:

```html
<uc-default-widget
  style="--pubkey:'demopublickey'; --darkmode: 1"
  css-src="../upload-blocks/themes/uc-basic/index.css">
</uc-default-widget>
```

Some of widget settings in this example are passed via CSS variables. That means you can use styles, CSS-classes and dedicated CSS-files to pass any setting to any block or redefine if using native DOM API or just native HTML syntax. 

### Configure
Configuration is specified in CSS. 
You can have mixed settings for different Upload Blocks instances. 

List of variables:
* --ctx-name (string) —
* --cfg-pubkey (string) — you project public key, found in Dashboard
* --cfg-multiple (boolean) — allow uploading multiple files
* --cfg-confirm-upload (boolean) —
* --cfg-img-only (boolean) — allow only images to be uploaded
* --cfg-accept () —
* --cfg-store (boolean or empty) — storing behaviour
* --cfg-camera-mirror (boolean) - 
* --cfg-source-list (string) — list of uploading sources being rendered by uploading widget
* --cfg-max-files (int) — maximum amount of files allowed to be uploaded at once

Variables are specified as CSS properties in your <style> tag. For example:
```
?
```

### Usage (example)
In the page’s <body>, insert the <input> element:
```html
<upload-widget-btn />
```

## Upload Sources
Upload Blocks supports 14 upload sources, including local file storage, web-camera; external URL; cloud services, and social networks.

List or upload sources:
* ...

## Localization
Localization is a part of the configuration process.

The default is an English locale. 
If a string item is missing in a locale you created or customized, English will be a fallback.

## Customization
The Upload Blocks is designed to inherit styles from your page organically: 
dialog elements get scaled in line with your font size.



All content (except node_modules) fully accessible at https://uploadcare.github.io/jsdk/.

Contents:
* [Regular case](./regular/)
* [Inline case](./inline/)
* [Simplified case](./simplified/)
