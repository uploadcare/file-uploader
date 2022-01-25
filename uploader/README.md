# uc-uploader

Here you can find the set of ready-made uploaders for the most frequent file uploading cases. Each uploader is highly customizable itself and could be used as the custom build reference, but you can use it "as is":

* [Regular](./regular/) - the most common solution
* [Inline](./inline/) - no modals, could be used just in place
* [Simplified](./simplified/) - minimal and compact

<re-htm src="./doc_assets/case.ref.htm" style="--case: 'case'"></re-htm>

## 💎 Solution benefits

* No heavy dependencies
* Uniform and seamless integration flow for the all major web-development stacks
* CSP (Content Security Policy) compatible: no `unsafe-inline` flags for the CSS or JavaScript are needed
* Modern and efficient technologies under the hood
* Multiple file source support
* Open source (MIT license)
* Built with love ❤️

## ⚙️ Integration

### CDN version 

Connect script:
```html
<script
  src="https://unpkg.com/@uploadcare/uploader@latest/build/regular/uc-uploader.min.js"
  type="module">
</script>
```

### npm package

Install package: `npm i @uploadcare/uploader`

Then you can use `Uploader`-element class for your purposes:
```javascript
import { Uploader } from '@uploadcare/uploader';

document.body.appendChild(new Uploader());
```

### Application markup
After connection, use the `<uc-uploader>` tag in your application markup:
```html
<uc-uploader></uc-uploader>
```
Note, that all configurations, localization texts, icons and styling are placed into CSS file, so you should connect the default one (or create your own):
```html
<style>
  @import url(https://unpkg.com/@uploadcare/uploader@latest/build/regular/uc-uploader.css);
  .my-settings {
    --ctx-name: 'my-uploader';
    --cfg-pubkey: 'demopublickey';
  }
</style>

<uc-uploader 
  class="my-settings uc-wgt-common">
</uc-uploader>
```
`uc-wgt-common` - is a pre-defined common CSS class containing all basic uploader parameters

### Shadow DOM

If you need additional isolation and styling security level, you can get it with Shadow DOM. To enable it and encapsulate all styles into separated scope, use `css-src` attribute:
```html
<uc-uploader 
  css-src="https://unpkg.com/@uploadcare/uploader@latest/build/regular/uc-uploader.css">
</uc-uploader>
```

### Custom tags naming convention

By design, all custom elements should have a dash symbol (`-`) in their names. All custom tags used in uploader are prefixed with `uc-` part. 

Examples:
```html
...
<uc-icon></uc-icon>
...
<uc-button></uc-button>
...
<uc-whatever></uc-whatever>
...
```

So, to exclude naming collisions, use the other prefixes for your own custom elements.

Examples:
```html
...
<my-own-icon></my-own-icon>
...
<my-own-button></my-own-button>
...
<my-own-whatever></my-own-whatever>
...
```

## 🛠 Configuration

There are two major parameters you should know about first of all:
1. Your Uploadcare project public key: `--cfg-pubkey: 'YOUR_PUBLIC_KEY';`
2. Workflow context name: `--ctx-name: 'CONTEXT_NAME';`

### Public key

You should obtain a Public API Key in your [Uploadcare project's dashboard](https://app.uploadcare.com/projects/-/api-keys/) to use file uploading features.

For demo-only purposes, you can use `demopublickey` instead.

### Context name

Our concept of workflow contexts is very similar to native HTML `name` attributes for the "radio" inputs. When you using the same names, elements are starting to act in the one common context. In case of "radio" inputs, all elements at the same context will know the state of the others (and you can make only one possible selection). 

In case of uploader, you can also set context with a `ctx-name` attribute or `--ctx-name` custom CSS property. That helps to create the link between each uploader instance and the any of its internal or external entity. By default, context will be created automatically, but if you need to bind uploader to the some other workflow, you can use the following approach:
```html
...
<uc-uploader ctx-name="my-uploading-workflow"></uc-uploader>
...
<uc-data-output ctx-name="my-uploading-workflow"></uc-data-output>
...
```

For more information, please visit ["context" section](https://symbiotejs.org/?context) in Symbiote.js documentation.

### CSS custom properties

All configurations could be provided via the set of [CSS-variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties):
```css
.my-settings {
  --cfg-pubkey: 'demopublickey';
  --cfg-multiple: 1;
  --cfg-img-only: 0;
  --cfg-source-list: 'local, url, camera, dropbox, gdrive, facebook';
  ...
}
```
Variable value should be a correct JSON value. Strings shoud be taken in quotes. We use the `1` or `0` numbers to define boolean flags.

Any configuration value can be defined and redefined at any level of the DOM tree, regarding of CSS selector specificity.

More details about configuration parameters you can find [HERE](../upload-blocks/docs/configuration/)

## 🎀 Styling

For the look & feel customization, you can use "Elements" section in your browser developer tools panel. It's easy to find any of uploader inner components and their contents, becouse they have custom tag names. You don't need any specific tools for that, unlike with the such libraries as React. Those tag names could be used as the convenient CSS selectors.

There are three major levels of possible styling customizations:

1. Light and dark theme flag: `--darkmode:1;` (enabled) or `--darkmode:0;` (disabled)
2. The set of basic CSS variables which are used for the other styling calculations
3. Custom CSS rules for the each element

For more details, please follow these [guide](../upload-blocks/themes/uc-basic/).

## 🟢 CSP settings

To be updated...

## 📤 Data output

We providing the dedicated block for the data output purposes - `<uc-data-output>`. 
This is a Custom Element which can be connected to some workflow context and provide you the convenient data access.

Here is the code example:

```html
<uc-data-output
  console
  fire-events
  item-template="<img src='https://ucarecdn.com/{{uuid}}/-/preview/' />">
</uc-data-output>
```
Let's walk through its attributes:

* `console` - this flag lets you enable browser console output without modifing the source code.
* `fire-events` - this flag enables custom events (`data-output`) dispatching for the DOM-element. These events are containig all uploading data and could be processed at the any level of your application
* `from` - data output could be connected to any field in the workflow context. You can specify the certain one. By default it is a `*dataOutput`, you can skip this setting for the default uploading case
* `item-template` - uploading resuls cold be rendered as a list of nested DOM-elements. You can specify simple template for that.
* `form-value` - could be used to handle HTML-forms