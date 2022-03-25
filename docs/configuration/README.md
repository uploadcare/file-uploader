# Configuration

We use Data-in-CSS approach to set configurations.

This is the list of pre-defined parameters, used by default in our uploader builds:
```css
.uc-wgt-cfg, .uc-wgt-common, :host {
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
As you can see, all properties are grouped for the set of selectors:

* `.uc-wgt-cfg` - specific selector for the configuration section in common CSS
* `.uc-wgt-common` - common class for the all types of settings and CSS data
* `:host` - Shadow DOM root element selector (used when Shadow DOM is enabled)

Variable value should be a correct JSON value. Strings shoud be taken in quotes. We use the `1` or `0` numbers to define boolean flags.

Any configuration value can be defined and redefined at any level of the DOM tree, regarding of CSS selector specificity.

## Parameters description

| Name | Description | Values | Default |
|:-|:-|:-:|:-:|
|`--cfg-pubkey`| Your project Public Key | `'demopublickey'` | none |
|`--cfg-multiple`| Allow to upload multiple files | `1` or `0` | `1` |
|`--cfg-confirm-upload`| Enables user confirmation for upload starting | `1` or `0` | `1` |
|`--cfg-img-only`| Accept images only | `1` or `0` | `0` |
|`--cfg-accept`| Native file input accept attribute value |`'image/*'`| none |
|`--cfg-store`| Store files | `1` or `0` | - |
|`--cfg-camera-mirror`| Flip camera image | `1` or `0` | `0` |
|`--cfg-source-list`| Comma-separated list of file sources |`'local, url, camera'`| none |
|`--cfg-max-files`| Maximum files in upload list | number | none |
|`--cfg-max-local-file-size-bytes`| Maximum file size in bytes | - | none |
|`--cfg-thumb-size`| Image thumbnail size | `76` | `76` |
|`--cfg-show-empty-list`| Show uploads list when it's empty | `1` or `0` | `0` |
|`--cfg-use-local-image-editor`| Enable local image editing | `1` or `0` | `0` |
|`--cfg-use-cloud-image-editor`| Enable cloud image editing | `1` or `0` | `0` |

## Possible values for the source list

* `local`
* `url`
* `camera`
* `dropbox `
* `gdrive`
* `facebook`
* `gphotos`
* `instagram`
* `flickr`
* `vk`
* `evernote`
* `box`
* `onedrive`
* `huddle`

## Custom configurations

You can create your own custom parameters and values for your custom blocks:

```css
.my-custom-config {
  --cfg-my-custom-property: 'SOME VALUE';
}
```

Then you can read it in your upload-block:
```javascript
import { BlockComponent } from 'upload-blocks/BlockComponent/BlockComponent.js';

class MyBlock extends BlockComponent {
  initCallback() {
    let statePropName = this.bindCssData('--cfg-my-custom-property'); 
    // ^ this will return '*--cfg-my-custom-property'
    this.sub(statePropName, (val) => {
      console.log(val);
    });
  }
}
```