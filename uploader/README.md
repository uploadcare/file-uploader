# uc-uploader

Here you can find the set of ready-made uploaders for the most frequent file uploading cases. Each uploader is highly customizable itself and could be used as the custom build reference, but you can use it "as is".

Contents:
* [Regular case](./regular/)
* [Inline case](./inline/)
* [Simplified case](./simplified/)

<re-htm src="./doc_assets/case.ref.htm" style="--case: 'case'"></re-htm>

### Basic configuration

`--cfg-pubkey: 'demopublickey';`
`--ctx-name: 'my-uploader';`


All basic configurations for each block could be provided via the set of [CSS-variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties):
```css
:host {
  --cfg-pubkey: 'demopublickey';
  --cfg-multiple: 1;
  --cfg-confirm-upload: 1;
  --cfg-img-only: 0;
  --cfg-accept: '';
  --cfg-store: 1;
  --cfg-camera-mirror: 1;
  --cfg-source-list: 'local, url, camera, dropbox, gdrive, facebook';
  --cfg-max-files: 10;
  --cfg-max-local-file-size-bytes: 30000;
  --cfg-thumb-size: 76;
  --cfg-show-empty-list: 0;
  --cfg-use-local-image-editor: 0;
  --cfg-use-cloud-image-editor: 0;
}
```
Variable value should be a correct JSON value. Strings shoud be taken in quotes. We use the `1` or `0` numbers to define boolean flags.

Any configuration value can be defined and redefined at any level of the DOM tree, at any time.

## 📤 Data output

We providing the dedicated block for the data output purposes - `<uc-data-output>`. 
This is a Custom Element which can be connected to some workflow context and provide you the convenient data access.

Here is the code example:

```html
<uc-data-output
  console
  fire-events
  from="*outputData"
  item-template="<img src='https://ucarecdn.com/{{uuid}}/-/preview/' />">
</uc-data-output>
```
Let's walk through its attributes:

* `console` - this flag lets you enable browser console output without modifing the source code.
* `fire-events` - this flag enables custom events (`data-output`) dispatching for the DOM-element. These events are containig all uploading data and could be processed at the any level of your application
* `from` - data output could be connected to any field in the workflow context. You can specify the certain one. By default it is a `*dataOutput`, you can skip this setting for the default uploading case
* `item-template` - uploading resuls cold be rendered as a list of nested DOM-elements. You can specify simple template for that.
* `form-value` - could be used to handle HTML-forms