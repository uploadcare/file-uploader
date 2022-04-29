# Adaptive Image

> Universal web-component for the efficient image representation at any page.
> It generates the set of URLs for the initial image source with the desired parameters.

<re-htm src="./demo.snippet.htm"><re-htm>

## Solution benefits

- No need to initiate something or to scan document: browser takes care about it.
- Uniform integration for the most of modern stacks.
- Modern standards support: `srcset`, native lazy loading, breakpoints, etc...
- Creates adaptive background images if needed.
- You need HTML and CSS only, to set it up.

## Quick start

Connect script:

```html
<script src="https://unpkg.com/@uploadcare/uc-blocks@latest/web/uc-img.min.js" type="module"></script>
```

Add basic settings:

```css
uc-img {
  --uc-img-pubkey: 'YOUR_PROJECT_PUBLIC_KEY';
  --uc-img-breakpoints: '200, 500, 800';
}
```

Public key is necessary for the Proxy links generation, if custom proxy name is not used. You can obtain public key in your [Uploadcare project's dashboard](https://app.uploadcare.com/projects/-/api-keys/).

Then use `<uc-img>` tag for the images in your HTML templates:

```html
<uc-img src="SOURCE_IMAGE_PATH"></uc-img>
```

That's it!

## Workflow

1. Web component initiating and read it's settings, including the source image path.
2. Component uses [Uploadcare Proxy](https://uploadcare.com/docs/delivery/proxy/) service to upload the source image if that was not done before.
3. Image component generates all necessary src sets for the resulting image and renders the `img` tag into the DOM.

## Fallback

For the SEO or NOSCRIPT purposes, use `<noscript>` sections on your integrations with the original image path:

```html
<uc-img src="SOURCE_IMAGE_PATH">
  <noscript>
    <img src="SOURCE_IMAGE_PATH" />
  </noscript>
</uc-img>
```

After initiating, if JavaScript is enabled in browser, that will be transformed into:

```html
<uc-img src="SOURCE_IMAGE_PATH">
  <img srcset="...GENERATED_SRC_LIST" />
</uc-img>
```

## Lazy loading

[Native lazy loading](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-loading) is enabled by default for all image components. You can disable it at all or use custom one based on [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API).

Disable:

```html
<style>
  uc-img {
    --uc-img-lazy: 0;
  }
</style>

<uc-img src="SOURCE_IMAGE_PATH"></uc-img>
```

Intersection observer enabled:

```html
<style>
  uc-img {
    --uc-img-intersection: 1;
  }
</style>

<uc-img src="SOURCE_IMAGE_PATH"></uc-img>
```

## Breakpoints

If you have some responsive layout where images could be resized in some cases, it's good to set a list of breakpoints to avoid exceed sized generation via Uploadcare CDN operations:

```html
<style>
  @import url('./test.css');

  uc-img {
    --uc-img-breakpoints: '400, 800, 1200';
  }
</style>

<uc-img src="SOURCE_IMAGE_PATH"></uc-img>
```

That will save the resources and make image behavior more expected. Browser will select most suitable image size automatically.

## Layout shift

It's a good practice to set up initial size for the images to avoid layout shifting during loading.

## CDN Operations

You can provide some transformation settings for the single image or for the set of images:

```html
<style>
  .invert {
    --uc-img-cdn-operations: 'invert';
  }
</style>

<uc-img class="invert" src="SOURCE_IMAGE_PATH"></uc-img>
```

Operations description syntax is the same as used in [REST API](https://uploadcare.com/docs/transformations/image/). More examples:

```html
<style>
  .invert_grayscale {
    --uc-img-cdn-operations: 'invert/-/grayscale';
  }
  .old_styled {
    --uc-img-cdn-operations: 'saturation/-80/-/contrast/80/-/warmth/50';
  }
</style>
```

As you can see, transformation definitions are separated with `/-/` symbols, just like you can use it in the REST API.

## Background mode

To use adaptive image as an element's background, you can use `is-background-for` attribute with the desired element's CSS selector in it's value:

```html
<style>
  #target {
    background-size: cover;
  }
</style>

<div id="target">Some text...</div>

<uc-img is-background-for="#target" src="SOURCE_IMAGE_PATH"></uc-img>
```

## Development mode (relative image path)

When you developing your application you can use some local development server and relative paths in your project structure for the images. In that case, Uploadcare Proxy service would be disabled for you development environment and you will see original local images in your application until you deploy it:

```html
<uc-img src="../LOCAL_IMAGE_PATH"></uc-img>
```

## UUID

If you already have UUID for images uploaded to Uploadcare, you can use it in image component directly:

```html
<uc-img uuid="CDN_UUID"></uc-img>
```

In this case, you don't need the `pubkey` setting to upload the source image.

## Settings

CSS context properties are available for the all nested elements of any container just like any other CSS properties. HTML attribute settings has more priority and can redefine other settings.

| CSS context property       | HTML Attribute    | Default value | Type        |
| :------------------------- | :---------------- | :------------ | :---------- |
| --uc-img-dev-mode          | dev-mode          | none          | number flag |
| --uc-img-pubkey            | pubkey            | none          | string      |
| --uc-img-uuid              | uuid              | none          | string      |
| --uc-img-src               | src               | none          | string      |
| --uc-img-lazy              | lazy              | `1`           | number flag |
| --uc-img-intersection      | intersection      | `0`           | number flag |
| --uc-img-breakpoints       | breakpoints       | none          | string      |
| --uc-img-cdn-cname         | cdn-cname         | none          | string      |
| --uc-img-proxy-cname       | proxy-cname       | none          | string      |
| --uc-img-hi-res-support    | hi-res-support    | `1`           | number flag |
| --uc-img-ultra-res-support | ultra-res-support | `0`           | number flag |
| --uc-img-format            | format            | `'webp'`      | string      |
| --uc-img-cdn-operations    | cdn-operations    | none          | string      |
| --uc-img-progressive       | progressive       | none          | number flag |
| --uc-img-quality           | quality           | `'smart'`     | string      |
| --uc-img-is-background-for | is-background-for | none          | string      |
