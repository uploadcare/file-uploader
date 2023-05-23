# Upload data output

## Basics

As the result of file uploading process, we getting some data, which needs to be processed somehow by the host application. There is dedicated block provided for this purpose: `lr-data-output`.

This element can be used to interact with a native HTML-forms or to extract the data in your javascript code.

The first step, is creating an output HTML-element somewhere in your application markup:

```html
<lr-data-output></lr-data-output>
```

You need to provide data context name to bind certain uploader instance to the output-element instance:

```html
<lr-data-output ctx-name="<MY_CTX>"></lr-data-output>
```

Then you need to enable data event firing:

```html
<lr-data-output ctx-name="<MY_CTX>" use-event></lr-data-output>
```

Now this element fires the event each time when user finished uploading workflow:

```js
let outputElement = document.querySelector('lr-data-output');

outputElement.addEventListener('lr-data-output', (e) => {
  console.log(e.detail);
  // or
  console.log(outputElement.value);
});
```

You also can enable browser console output for the setup testing:

```html
<lr-data-output ctx-name="<MY_CTX>" use-event use-console></lr-data-output>
```

## Forms

It's possible to use `lr-data-output` inside the native [HTML forms](https://developer.mozilla.org/ru/docs/Web/HTML/Element/form):

```html
<form method="post" action="/action">
  <lr-data-output ctx-name="<MY_CTX>" use-input input-name="my-file"></lr-data-output>
</form>
```

In this case, a `hidden` `input` element will be created, and the URL of uploaded files or group result will be provided as the text input value.

## Output data rendering

It's possible to render the output data using [Symbiote.js](https://github.com/symbiotejs/symbiote.js) features:

```html
<lr-data-output ctx-name="<MY_CTX>">
  <h2>Upload result:</h2>
  <div repeat="filesData">
    <div>{{uuid}}</div>
  </div>
</lr-data-output>
```

### How it works

Symbiote component allows to take [control of its nested markup](https://symbiotejs.org/?control_capture) and to use it as component's template. And you can use the canonical Symbiote.js [dynamic list rendering](https://symbiotejs.org/?list) for the uploading data representation. As you can see, all you need is just to add some additional HTML. That's it.
