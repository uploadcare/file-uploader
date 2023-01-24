# Activities

**Activity** — is a current user interaction stage focused on the uploader application. It helps manage the visibility of components and switches between several UI states. To create an activity, you will need to register it in your custom block:

```javascript
import { LR } from '@uploadcare/blocks';

class MyBlock extends LR.BlockComponent {
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

Then, if some other component will call the registered activity, it will be activated with `active` attribute, and the activation callback will be called.

JavaScript:

```javascript
import { LR } from '@uploadcare/blocks';

class MyOtherBlock extends LR.BlockComponent {
  onclick = () => {
    this.$['*currentActivity'] = 'my-activity-name';
  };
}
```

Resulting HTML:

```html
<lr-my-block activity="my-activity-name" active>...</lr-my-block>
```

Then you can use `lr-my-block[active]` selector to specify visibility or animations with CSS.

Here is the list of reserved pre-defined activities:

- `source-select`
- `camera`
- `upload-list`
- `url`
- `confirmation`
- `cloud-image-edit`
- `*external`
- `details`
