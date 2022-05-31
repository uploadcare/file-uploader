# `--cfg-secure-delivery-proxy`

The parameter can be used with [signed URLs](https://uploadcare.com/docs/security/secure-delivery/#authenticated-urls). Defines template for your proxy [backend URL](https://uploadcare.com/docs/security/secure-delivery/#proxy-backend).

This is replacement for the [File Uploader `previewProxy` option](https://uploadcare.com/docs/security/secure-delivery/#preview-proxy).

**NOTE**: There is no replacement for [File Uploader `previewUrlCallback` option](https://uploadcare.com/docs/security/secure-delivery/#preview-url-callback). If you need such functionality, please contact us at WIP

Value for `--cfg-secure-delivery-proxy` is a string template with the following variables:

- `previewUrl`

That means that you can use `{{previewUrl}}` in your template to insert the URL of file to proxify.

## Example

```css
.my-configuration {
  --cfg-secure-delivery-proxy: 'https://domain.com/preview?url={{previewUrl}}';
}
```
