# Activities

**Activity** - is a current user interaction stage focused by uploader application. It helps to manage visibility of components and to switch between several UI states. To create activity, you will need to register it in your custom upload-block:

```javascript
import { UC } from '@uploadcare/upload-blocks';

class MyBlock extends UC.BlockComponent {
  initCallback() {
    this.onActivation = () => {
      '*activityCaption': this.l10n('some-caption'),
      '*activityIcon': 'my-icon-name',
    };
    this.onDeactivation = () => {
      console.log('activity-name is deactivated');
    };
    this.registerActivity('my-activity-name', this.onActivation, this.onDeactivation);
  }
}
```

Then, if some other component will cal the registered activity, it will be activated with `active` attribute and the activation callback will be called.

JavaScript: 
```javascript
import { UC } from '@uploadcare/upload-blocks';

class MyOtherBlock extends UC.BlockComponent {
  onclick = () => {
    this.$['*currentActivity'] = 'my-activity-name';
  };
}
```

Resulting HTML:
```html
<uc-my-block activity="my-activity-name" active>...</uc-my-block>
```

Then you can use `uc-my-block[active]` selector to specify visibility or animations with CSS.

Here is the list of reserved pre-defined activities:

* `source-select`
* `camera`
* `upload-list`
* `url`
* `confirmation`
* `cloud-image-edit`
* `*external`
* `details`

