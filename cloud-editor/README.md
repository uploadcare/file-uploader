# example

```html
<uc-editor id="editor" uuid="84313a71-6c6d-4064-83f5-abcba112b67b" public-key="demopublickey"></uc-editor>
<script>
  let editor = document.querySelector('#editor');
  editor.addEventListener('apply', e => {
    let {originalUrl, transformationsUrl, transformations} = e.detail;
    console.log('APPLY', {originalUrl, transformationsUrl, transformations})
  })
  editor.addEventListener('cancel', e => {
    console.log('CANCEL')
  })
```
