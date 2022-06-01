# Configuration

We use the Data-in-CSS approach to set configurations.

This is the list of pre-defined parameters used by default in our uploader builds:

```css
:where(.lr-wgt-cfg, .lr-wgt-common),
:host {
  --cfg-pubkey: 'YOUR_PUBLIC_KEY';
  --cfg-multiple: 1;
  --cfg-multiple-min: 0;
  --cfg-multiple-max: 0;
  --cfg-confirm-upload: 1;
  --cfg-img-only: 0;
  --cfg-accept: '';
  --cfg-store: 1;
  --cfg-camera-mirror: 1;
  --cfg-source-list: 'local, url, camera, dropbox, gdrive, facebook';
  --cfg-max-local-file-size-bytes: 0;
  --cfg-thumb-size: 76;
  --cfg-show-empty-list: 0;
  --cfg-use-local-image-editor: 0;
  --cfg-use-cloud-image-editor: 1;

  --cfg-modal-scroll-lock: 1;
  --cfg-modal-backdrop-strokes: 1;

  --cfg-source-list-wrap: 1;

  --cfg-init-activity: 'start-from';
  --cfg-done-activity: 'start-from';

  --cfg-data-output-console: 1;
  --cfg-data-output-fire-events: 1;
  --cfg-data-output-from: '*dataOutput';
  --cfg-data-output-form-value: 1;

  --cfg-remote-tab-session-key: '';
}
```

As you can see, all properties are grouped for the set of selectors:

- `.lr-wgt-cfg` - specific selector for the configuration section in common CSS
- `.lr-wgt-common` - common class for all types of settings and CSS data
- `:host` - Shadow DOM root element selector (used when Shadow DOM is enabled)

The variable value should be a correct JSON value. Strings should be taken in quotes. We use the 1 or 0 numbers to define boolean flags.

Any configuration value can be defined and redefined at any level of the DOM tree regarding CSS selector specificity.

## Parameters description

| Name                              | Description                                                                                                                            |         Values         |        Default         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | :--------------------: | :--------------------: |
| `--cfg-pubkey`                    | Your project Public Key                                                                                                                |   `'demopublickey'`    |          none          |
| `--cfg-multiple`                  | Allow to upload multiple files                                                                                                         |       `1` or `0`       |          `1`           |
| `--cfg-multiple-min`              | Minimum number of files that can be selected.                                                                                          |         number         |          none          |
| `--cfg-multiple-max`              | Maximum number of files that can be selected.                                                                                          |         number         |          none          |
| `--cfg-confirm-upload`            | Enables user confirmation for upload starting                                                                                          |       `1` or `0`       |          `1`           |
| `--cfg-img-only`                  | Accept images only                                                                                                                     |       `1` or `0`       |          `0`           |
| `--cfg-accept`                    | Native file input accept attribute value                                                                                               |      `'image/*'`       |          none          |
| `--cfg-store`                     | Store files                                                                                                                            |       `1` or `0`       |           -            |
| `--cfg-camera-mirror`             | Flip camera image                                                                                                                      |       `1` or `0`       |          `0`           |
| `--cfg-source-list`               | Comma-separated list of file sources. See [here](./source-list/) for details                                                           | `'local, url, camera'` |          none          |
| `--cfg-max-local-file-size-bytes` | Maximum file size in bytes                                                                                                             |           -            |          none          |
| `--cfg-thumb-size`                | Image thumbnail size                                                                                                                   |          `76`          |          `76`          |
| `--cfg-show-empty-list`           | Show uploads list when it's empty                                                                                                      |       `1` or `0`       |          `0`           |
| `--cfg-use-local-image-editor`    | Enable local image editing                                                                                                             |       `1` or `0`       |          `0`           |
| `--cfg-use-cloud-image-editor`    | Enable cloud image editing                                                                                                             |       `1` or `0`       |          `0`           |
| `--cfg-remote-tab-session-key`    | Key to revoke Custom OAuth access. See [docs](https://uploadcare.com/docs/start/settings/#project-settings-advanced-oauth) for details |         string         |          none          |
| `--cfg-cdn-cname`                 | Set Custom CNAME. See [docs](https://uploadcare.com/docs/delivery/cdn/#custom-cdn-cname) for details                                   |         string         | `https://ucarecdn.com` |
| `--cfg-secure-signature`          | Set `signature` for Secure Uploads. See [docs](https://uploadcare.com/docs/security/secure-uploads/#expire-explained) for details      |         string         |          none          |
| `--cfg-secure-expire`             | Set `expire` for Secure Uploads. See [docs](https://uploadcare.com/docs/security/secure-uploads/#expire-explained) for details         |         string         |          none          |
| `--cfg-secure-delivery-proxy`     | Set proxy URL template for Secure Delivery. See [here](./secure-delivery-proxy/) for details                                           |         string         |          none          |

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
