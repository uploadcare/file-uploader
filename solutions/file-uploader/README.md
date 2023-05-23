# File uploader

Here you can find a set of ready-made uploaders for the most frequent file uploading use-cases. Each uploader is highly customizable on its own and could be used as a custom build reference, or you can use it as is.

### On this page you'll find

#### Solutions

- [Regular case](#example_regular) — the most common solution.
- [Inline case](#example_inline) — no modals, could be used inline.
- [Minimal case](#example_mini) — minimal and compact.

#### Implementation

- [Configuration](#configuration)
- [Styling](#styling)
- [Data handling](#handling_data)
- [Events](#events)
- [Activities](#activities)

## 💎 Solution benefits

- No heavy dependencies, modern and efficient technologies under the hood.
- Uniform and seamless integration flow for all major web development stacks.
- CSP (Content Security Policy) compatible: no `unsafe-inline` flags for the CSS or JavaScript are needed.
- Multiple file sources (local, camera, external URLs, cloud services and social networks) support.
- Open source (MIT license).
- Built with love ❤️

## 🌎 Supported browsers

Blocks are supported and tested in all major modern desktop and mobile browsers:

- Chrome
- Firefox
- Safari
- Edge
- Opera

Internet Explorer is outdated and not supported [anymore](https://uploadcare.com/blog/uploadcare-stops-internet-explorer-support/).
<br/><br/><br/>

# <a name="example_regular"></a>Regular uploader

```html
<lr-file-uploader-regular></lr-file-uploader-regular>
```

<re-htm src="./regular/demo.htm"></re-htm>
<br/><br/><br/>

# <a name="example_inline"></a>Inline uploader

```html
<lr-file-uploader-inline></lr-file-uploader-inline>
```

<re-htm src="./inline/demo.htm"></re-htm>
<br/><br/><br/>

# <a name="example_mini"></a>Minimalistic uploader

```html
<lr-file-uploader-minimal></lr-file-uploader-minimal>
```

<re-htm src="./minimal//demo.htm"></re-htm>
<br/><br/><br/>

# <a name="configuration"></a>🛠 Configuration

## General

All configurations, localization texts, icons, and styling are placed into CSS file (if you aren't familiar with this concept, read about [blocks configuration](/get-started/configuration/)), so you should connect the default one (or create your own):

```html
<style>
  @import url(https://unpkg.com/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/file-uploader-regular.min.css);
  .my-settings {
    --ctx-name: 'my-uploader';
    --cfg-pubkey: 'demopublickey';
  }
</style>

<lr-uploader class="my-settings lr-wgt-common"> </lr-uploader>
```

- `lr-wgt-common` — is a pre-defined common CSS class containing all basic uploader parameters.

There are two major parameters you should know:

1. Your Uploadcare's project public key: `--cfg-pubkey: 'YOUR_PUBLIC_KEY';`.
2. Workflow context name: `--ctx-name: 'CONTEXT_NAME';`.

## Public key

You should get a Public API Key in your [Uploadcare project's dashboard](https://app.uploadcare.com/projects/-/api-keys/) to use file uploading features.

For demo-only purposes, you can use `demopublickey` instead.

## Context name

Our concept of workflow contexts is very similar to native HTML `name` attributes for the "radio" inputs. When you use the same names, elements act in one common context. In the case of "radio" inputs, all elements in the same context will know the state of the others (and you can make only one possible selection).

In the case of uploader, you can also set the context with a `ctx-name` attribute or `--ctx-name` custom CSS property. This helps to create the link between each uploader instance and its internal or external entities. By default, context is created automatically, but if you need to bind uploader to some other workflow, you can use the following approach:

```html
...
<lr-uploader ctx-name="my-uploading-workflow"></lr-uploader>
...
<lr-data-output ctx-name="my-uploading-workflow"></lr-data-output>
...
```

For more information, read about ["context"](https://symbiotejs.org/?context) in Symbiote.js documentation.

## CSS custom properties

All configurations could be provided via the set of [CSS-variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties):

```css
.my-settings {
  --cfg-pubkey: 'demopublickey';
  --cfg-multiple: 1;
  --cfg-img-only: 0;
  --cfg-source-list: 'local, url, camera, dropbox, gdrive, facebook';
  ...;
}
```

The variable value should be a correct JSON value. Strings should be taken in quotes. We use the `1` or `0` numbers to define boolean flags.

Any configuration value can be defined and redefined at any DOM-tree level regarding CSS selector specificity.

## Parameters description

| Name                                     | Description                                                                                                                                                              |         Values          |                 Default                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------: | :-------------------------------------: |
| `--cfg-pubkey`                           | Your project Public Key                                                                                                                                                  |         string          |            `YOUR_PUBLIC_KEY`            |
| `--cfg-multiple`                         | Allow to upload multiple files                                                                                                                                           |       `1` or `0`        |                   `1`                   |
| `--cfg-multiple-min`                     | Minimum number of files that can be selected                                                                                                                             |         number          |                  none                   |
| `--cfg-multiple-max`                     | Maximum number of files that can be selected                                                                                                                             |         number          |                  none                   |
| `--cfg-confirm-upload`                   | Enables user confirmation for upload starting                                                                                                                            |       `1` or `0`        |                   `1`                   |
| `--cfg-img-only`                         | Accept images only                                                                                                                                                       |       `1` or `0`        |                   `0`                   |
| `--cfg-accept`                           | Native file input accept attribute value                                                                                                                                 | comma separated string  |                  none                   |
| `--cfg-external-sources-preferred-types` | Defines the list of preferred MIME types for external sources. See [docs](https://uploadcare.com/docs/uploads/file-uploader-options/#option-preferred-types) for details | comma separated string  |                  none                   |
| `--cfg-store`                            | Store files                                                                                                                                                              |       `1` or `0`        |                    -                    |
| `--cfg-camera-mirror`                    | Flip camera image                                                                                                                                                        |       `1` or `0`        |                   `0`                   |
| `--cfg-source-list`                      | Comma-separated list of file sources. See available sources [below](#source-list)                                                                                        | comma separated string` | `'local, url, camera, dropbox, gdrive'` |
| `--cfg-max-local-file-size-bytes`        | Maximum file size in bytes                                                                                                                                               |         number          |                  none                   |
| `--cfg-thumb-size`                       | Image thumbnail size                                                                                                                                                     |          `76`           |                  `76`                   |
| `--cfg-show-empty-list`                  | Show uploads list when it's empty                                                                                                                                        |       `1` or `0`        |                   `0`                   |
| `--cfg-use-local-image-editor`           | Enable local image editing                                                                                                                                               |       `1` or `0`        |                   `0`                   |
| `--cfg-use-cloud-image-editor`           | Enable cloud image editing                                                                                                                                               |       `1` or `0`        |                   `0`                   |
| `--cfg-remote-tab-session-key`           | Key to revoke Custom OAuth access. See [docs](https://uploadcare.com/docs/start/settings/#project-settings-advanced-oauth) for details                                   |         string          |                  none                   |
| `--cfg-cdn-cname`                        | Set Custom CNAME. See [docs](https://uploadcare.com/docs/delivery/cdn/#custom-cdn-cname) for details                                                                     |         string          |        `'https://ucarecdn.com'`         |
| `--cfg-base-url`                         | Set custom upload URL                                                                                                                                                    |         string          |    `'https://upload.uploadcare.com'`    |
| `--cfg-secure-signature`                 | Set `signature` for Secure Uploads. See [docs](https://uploadcare.com/docs/security/secure-uploads/#expire-explained) for details                                        |         string          |                  none                   |
| `--cfg-secure-expire`                    | Set `expire` for Secure Uploads. See [docs](https://uploadcare.com/docs/security/secure-uploads/#expire-explained) for details                                           |         string          |                  none                   |
| `--cfg-secure-delivery-proxy`            | Set proxy URL template for Secure Delivery. See [here](#secure-delivery-proxy) for details                                                                               |         string          |                  none                   |
| `--cfg-group-output`                     | Enables files group creation                                                                                                                                             |       `1` or `0`        |                   `0`                   |
| `--cfg-remove-copyright`                 | Remove copyright                                                                                                                                                         |       `1` or `0`        |                   `0`                   |

## <a name="source-list"></a> --cfg-source-list

- `local`
- `url`
- `camera`
- `dropbox`
- `gdrive`
- `facebook`
- `gphotos`
- `instagram`
- `flickr`
- `vk`
- `evernote`
- `box`
- `onedrive`
- `huddle`

### Example

```css
.my-configuration {
  --cfg-source-list: 'url, local, instagram';
}
```

## <a name="secure-delivery-proxy"></a> --cfg-secure-delivery-proxy

The parameter can be used with [signed URLs](https://uploadcare.com/docs/security/secure-delivery/#authenticated-urls). Defines template for your proxy [backend URL](https://uploadcare.com/docs/security/secure-delivery/#proxy-backend).

This is replacement for the [File Uploader v3 `previewProxy` option](https://uploadcare.com/docs/security/secure-delivery/#preview-proxy).

**NOTE**: There is no replacement for [File Uploader v3 `previewUrlCallback` option](https://uploadcare.com/docs/security/secure-delivery/#preview-url-callback). If you need such functionality, please create [a feature request](https://github.com/uploadcare/blocks/issues/new?template=feature_request.md&title=Secure%20delivery%20proxy%20callback).

Value for `--cfg-secure-delivery-proxy` is a string template with the following variables:

- `previewUrl`

That means that you can use `{{previewUrl}}` in your template to insert the URL of file to proxify.

### Example

```css
.my-configuration {
  --cfg-secure-delivery-proxy: 'https://domain.com/preview?url={{previewUrl}}';
}
```

## CSP settings

If the application works with sensitive user data (e.g personal photos), it is recommended to increase its security with [CSP settings](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP). Uploader is using `Blob` URLs for on-the-flight generated images and the stylesheets in some cases, so don't forget to add `blob:` source into the CSP settings:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="style-src 'self' blob:; script-src 'self'; img-src 'self' https://ucarecdn.com blob:;"
/>
```

<br/><br/><br/>

# <a name="styling"></a>🎀 Styling

For the look & feel customization, you can use the "Elements" section in your browser developer tools panel. It's easy to find any uploader inner components and their contents because they have custom tag names. You don't need any specific tools, unlike with libraries like React. These tag names could be used as convenient CSS selectors.

There are three major levels of possible styling customizations:

1. Light and dark theme flag: `--darkmode:1;` (enabled) or `--darkmode:0;` (disabled).
2. The set of basic CSS variables used for the other styling calculations.
3. Custom CSS rules for each element.

## Basic theme for blocks

There are 4 levels of abstraction:

- [Base values](#base-values)
- [Derivative values](#derivative-values)
- [Common styles](#common-styles)
- [Component styles](#component-styles)

### HSL color space

We use HSL color space because it allows us to easily calculate derivative colors. That's what prefixes `--h-`, `--s-`, and `--l-` are stand for.

### Quick styling

In most cases switching the dark mode on or off and changing the accent color is enough to make block match your design.

<!-- If you want to do a deeper styling, see this guide.
TODO: write a guide. -->

```css
--darkmode: 1;
```

```css
--h-accent: 211;
--s-accent: 100%;
--l-accent: calc(50% - 5% * var(--darkmode));
```

## Base values

- `--darkmode` — `1`: dark mode enabled, `0`: disabled;
- `--*-foreground` — text color, borders, and shaders. It should be in contrast to the background;
- `--*-background` — background color and its variations;
- `--*-accent` — colors of buttons, links, and text input borders (hover and focus). It should be in contrast to the background;
- `--*-confirm` — the color of confirmation notifications and badges;
- `--*-error` — the color of error notifications and badges;
- `--opacity-*` — opacity of different states of small icon buttons;
- `--ui-size` — minimum size of a clickable element. Also used to calculate the size of the elements, which should be proportional to it;
- `--gap-*` — paddings and margins;
- `--gap-table` — the gap between elements in lists (for example, in upload-list);
- `--borders` — `1`: borders enabled, `0`: disabled. Can be fractional, for example, 0.5 will make borders half as opaque;
- `--border-radius-element` — border radius of buttons and inputs;
- `--border-radius-frame` — border radius of modal windows and drop area;
- `--border-radius-thumb` — border radius of thumbnails;
- `--transition-duration` — duration of all animated transitions;
- `--shadows` — `1`: shadows enabled, `0`: disabled. Can be fractional, for example 0.5, will make shadows half as opaque;
- `--*-shadow` — the color of box shadows;
- `--modal-max-w`, `--modal-max-h` — the maximum size of the modal window.

## Derivative values

Derivative values are calculated from the base values.

- `--darkmode-minus` — used for dark mode color calculations. Gives `-1` when dark mode is enabled, `1` when disabled;
- `--clr-background*` — lightness variations of the background color;
- `--clr-accent*` — opacity variations of the accent color;
- `--clr-confirm` — confirmation notifications color;
- `--clr-error` — opacity and lighness variations of the error notifications color;
- `--clr-txt*` — lightness variations of the text color;
- `--clr-shade-lv*` — shading colors (foreground color with a low opacity variations);
- `--border-*` — border variations;
- `--clr-curtain` — color of the background behind the modal window;
- `--clr-btn-bgr-primary*`, `--clr-btn-txt-primary`, `--shadow-btn-primary` — primary action button values;
- `--clr-btn-bgr-secondary*`, `--clr-btn-txt-secondary`, `--shadow-btn-secondary` — secondary action button values;
- `--clr-btn-bgr-disabled`, `--clr-btn-txt-disabled`, `--shadow-btn-disabled` — disabled button values.

## Common styles

Common styles define similar UI elements across different blocks: buttons, inputs, and links.

## Component styles

Component styles are the most specific.

<!-- TODO: decide about recommendations here -->

## Shadow DOM

If you need additional isolation and styling security levels, you can get it with Shadow DOM.
To enable it and encapsulate all styles into separated scope, use the `css-src` attribute:

```html
<lr-uploader css-src="https://unpkg.com/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/file-uploader-regular.min.css">
</lr-uploader>
```

<br/><br/><br/>

# <a name="handling_data"></a>🪤 Data handling

## With the data output

We provide the dedicated block for the data output purposes — `<lr-data-output>`. This Custom Element can be connected to some workflow context and provide you with convenient data access.

Here is the code example:

```html
<template id="output-template">
  <h3>Files uploaded:</h3>
  <div repeat="filesData">
    <lr-img width="300" set="@uuid: uuid"></lr-img>
    <div><a set="@href: cdnUrl">{{cdnUrl}}</a></div>
  </div>
</template>
<lr-data-output use-console use-event use-template="#output-template"> </lr-data-output>
```

Let's walk through its attributes:

- `use-console` — enables browser console output without modifying the source code.
- `use-event` — enables custom events (`data-output`) dispatching for the DOM element. These events contain all uploading data and could be processed at any level of your application.
- `use-group` - create group from uploaded files, the same as `--cfg-group-output`.
- `use-template` — uploading results could be rendered as a list of nested DOM elements. You can specify a simple template for that.
- `use-input` — create input to be used inside HTML-form.
- `input-name` — used together with `use-form`. Sets the input name. The context name will be used by default.
- `input-required` — whether the input is required or not. Works as the native [`required` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/required).

## With the event listener

```js
window.addEventListener('LR_DATA_OUTPUT', (e) => {
  console.log(e.detail);
});
```

<br/><br/><br/>

# <a name="events"></a>🔥 Events

## Upload flow events

- `LR_UPLOAD_START` — upload is started for the file list selected by the user
- `LR_REMOVE` — fired when one of the uploaded items is removed from the uploading list
- `LR_UPLOAD_PROGRESS` — common upload progress for the list
- `LR_UPLOAD_FINISH` — uploading is finished
- `LR_UPLOAD_ERROR` — error ocurred during file uploading
- `LR_VALIDATION_ERROR` — file fails checks according to the validation settings
- `LR_CLOUD_MODIFICATION` — image was modified via cloud API
- `LR_DATA_OUTPUT` — common data about uploads

You can catch all events in window scope:

```js
window.addEventListener('LR_UPLOAD_START', (e) => {
  console.log(e.detail);
});
```

To define what exact workflow caused an event, use the context name:

```html
...
<lr-file-uploader-regular ctx-name="UPLOADER_1"></lr-file-uploader-regular>
...
<lr-file-uploader-regular ctx-name="UPLOADER_2"></lr-file-uploader-regular>
...
```

```js
window.addEventListener('LR_UPLOAD_START', (e) => {
  if (e.detail.ctx === 'UPLOADER_1') {
    console.log('Uploading started in the FIRST uploader instance.', e.detail.data);
  } else if (e.detail.ctx === 'UPLOADER_2') {
    console.log('Uploading started in the SECOND uploader instance.', e.detail.data);
  }
});
```

<br/><br/><br/>

# <a name="activities"></a>Activities

_Activity_ is a current user interaction stage focused on the uploader application. It helps manage the visibility of components and switches between several UI states. To create an activity, you should register it in your custom block:

```javascript
import { LR } from '@uploadcare/blocks';

class MyBlock extends LR.BlockComponent {
  initCallback() {
    const onActivate = () => {
      console.log('activity-name is activated');
    };
    const onDeactivate = () => {
      console.log('activity-name is deactcivated');
    };
    this.registerActivity('my-activity-name', {
      onActivate,
      onDeactivate,
    });
  }
}
```

Then, if some other component will call the registered activity, it will be activated with an `active` attribute, and the activation callback will be called.

JavaScript:

```javascript
import { LR } from '@uploadcare/blocks';

class MyOtherBlock extends LR.BlockComponent {
  onclick = () => {
    this.$['*currentActivity'] = 'my-activity-name';
  };
}
```

Resulting HTML:

```html
<lr-my-block activity="my-activity-name" active>...</lr-my-block>
```

Then you can use `lr-my-block[active]` selector to specify visibility or animations with CSS.

Here is the list of reserved pre-defined activities:

- `source-select`
- `camera`
- `upload-list`
- `url`
- `confirmation`
- `cloud-image-edit`
- `*external`
- `details`
