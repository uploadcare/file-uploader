# Ready made solutions

- [File uploader](./file-uploader/) - file uploading widgets:

  - [Regular](./file-uploader/regular/) - the most common case
  - [Inline](./file-uploader/inline/) - inline mode (no modal)
  - [Minimal](./file-uploader/minimal/) - simple and compact

- [Adaptive image](./adaptive-image/) - efficient image rendering automation

- [Cloud image editor](./cloud-image-editor/) - rich UI for CDN transformations API

## Integration

### Script tag approach

> We recommend to use the one of modern code distribution services, such as:
>
> - https://www.skypack.dev/
> - https://www.jsdelivr.com/
> - https://unpkg.com/
> - etc.

Connect script to your document:

```html
<script src="https://cdn.skypack.dev/@uploadcare/blocks/web/blocks-browser.min.js" type="module"></script>
```

Then you can use blocks in your application markup.

File uploader example:

```html
<lr-file-uploader-regular css-src="https://cdn.skypack.dev/@uploadcare/blocks/web/file-uploader-regular.min.css">
</lr-file-uploader-regular>
```

### Dynamic script connection (types support)

First, install the npm package:

```sh
npm i @uploadcare/blocks
```

Then use `connectBlocksFrom` function to connect blocks:

```js
import { connectBlocksFrom } from '@uploadcare/blocks/abstract/connectBlocksFrom.js';

const STYLES = 'https://cdn.skypack.dev/@uploadcare/blocks/web/file-uploader-regular.min.css';

connectBlocksFrom('https://cdn.skypack.dev/@uploadcare/blocks/web/blocks-browser.min.js').then((blocks) => {
  if (!blocks) {
    return; // To avoid errors in SSR case
  }

  // Now you can add uploader using native DOM API methods:
  const uploader = new blocks.FileUploaderRegular();
  uploader.setAttribute('css-src', STYLES);
  document.body.appendChild(uploader);
});
```

### Advanced mode

Install the npm package:

```sh
npm i @uploadcare/blocks
```

Than you can use blocks and build your own solutions from the source code:

```js
import * as LR from '@uploadcare/blocks';

LR.registerBlocks(LR);
```

## Configuration

All the settings for the blocks could be provided with CSS. It could be CSS-files or
CSS rules defined somewhere in your project.

We recommend to use Shadow DOM mode enabled if you planning to use several solutions
on one page at once.

`css-src` - attribute enables Shadow DOM and all provided styles start to work inside of it. That helps to avoid any possible collisions in styling and to control the scoping better.

## Context

Each block plays it's onw role in some context. Context helps to connect some blocks into the one data flow, if they placed somewhere in host application. You can set this context manually to bind one block to another using `ctx-name` attribute:

```html
<lr-file-uploader-regular ctx-name="MY_CONTEXT"></lr-file-uploader-regular>
```

## Events

To get useful workflow data from the blocks you can use events. Block events are firing to the window scope, so you don't need to have a link or reference to the certain DOM-element. To define what exact workflow caused the event, use context name:

```js
window.addEventListener('LR_DATA_OUTPUT', (e) => {
  if (e.detail.ctx === 'MY_CONTEXT') {
    // oh, now I know where it comes from...
    console.log(e.detail.data);
  }
});
```

More event types you can find [here](../docs/events/).

## Customization

With blocks you can customize everything:

- Styles
- Texts
- Icons
- Layouts

You can redefine styling or any other setting using custom CSS file. It's easy to discover proper elements and their selectors using developer tools in your browser.

Custom CSS-file example:

```css
@import url('https://cdn.skypack.dev/@uploadcare/blocks/web/file-uploader-regular.min.css');

lr-modal {
  border: 2px solid #f00;
}
```

Then just connect it to the integrated solution:

```html
<lr-file-uploader-regular css-src="./my-custom-styles.css"> </lr-file-uploader-regular>
```
