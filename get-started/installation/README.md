# Installation

## Script tag approach

> We recommend to use the one of modern code distribution services, such as:
>
> - https://www.skypack.dev/
> - https://www.jsdelivr.com/
> - https://unpkg.com/
> - etc

Connect script to your document:

```html
<script src="https://unpkg.com/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/blocks-browser.min.js" type="module"></script>
```

Then you can use blocks in your application markup.

File uploader example:

```html
<lr-file-uploader-regular
  css-src="https://unpkg.com/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/file-uploader-regular.min.css"
>
</lr-file-uploader-regular>
```

## Dynamic script connection (types support)

First, install the npm package:

```sh
npm i @uploadcare/blocks
```

Then use `connectBlocksFrom` function to connect blocks:

```js
import { connectBlocksFrom } from '@uploadcare/blocks/abstract/connectBlocksFrom.js';

connectBlocksFrom('https://unpkg.com/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/blocks-browser.min.js');
```

That's it! Now you can use components for placing into html, like this:

```html
<lr-file-uploader-inline
  css-src="https://unpkg.com/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/file-uploader-inline.min.css"
  class="my-config-class"
></lr-file-uploader-inline>
```

You may need to implement some logic, which depends on connected blocks or get access directly to the imported components. Since `connectBlocksFrom` returns `Promise`, place all you need using `.then()`

```js
import { connectBlocksFrom } from '@uploadcare/blocks/abstract/connectBlocksFrom.js';

const STYLES = 'https://unpkg.com/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/file-uploader-regular.min.css';

connectBlocksFrom('https://unpkg.com/@uploadcare/blocks@{{PACKAGE_VERSION}}/web/blocks-browser.min.js').then(
  (blocks) => {
    if (!blocks) {
      return; // To avoid errors in SSR case
    }

    // Now you can realize your logic, e.g.:
    const uploader = new blocks.FileUploaderRegular();
    uploader.setAttribute('css-src', STYLES);
    document.body.appendChild(uploader);
  }
);
```

## Advanced mode

Install the npm package:

```sh
npm i @uploadcare/blocks
```

Then you can use blocks and build your own solutions from the source code:

```js
import * as LR from '@uploadcare/blocks';

LR.registerBlocks(LR);
```

## Custom tags naming convention

By design, all custom elements should have a dash symbol (`-`) in their names.
All custom tags used in uploader are prefixed with the `lr-` part.

Examples:

```html
...
<lr-icon></lr-icon>
...
<lr-button></lr-button>
...
<lr-whatever></lr-whatever>
...
```

To exclude naming collisions, use the other prefixes for your own custom elements.

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

## [Next step: Configuration](/get-started/configuration/) ➡️
