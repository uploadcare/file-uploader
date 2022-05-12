# Texts

All keys and values for the UI texts and translations are also placed in CSS:
```css
.uc-wgt-l10n_en-US, .uc-wgt-common, :host {
  --l10n-upload-file: 'Upload file';
  --l10n-upload-files: 'Upload files';
  --l10n-drop-files-here: 'Drop files here...';
  --l10n-select-file-source: 'Select file source';
  --l10n-selected: 'Selected';
  --l10n-upload: 'Upload';
  --l10n-add-more: 'Add more';
  --l10n-cancel: 'Cancel';
  --l10n-clear: 'Clear';
  --l10n-camera-shot: 'Shot';
  --l10n-upload-url: 'Import';
  --l10n-edit-image: 'Edit image';
  --l10n-edit-detail: 'Details';
  --l10n-back: 'Back';
  --l10n-done: 'Done';
  --l10n-remove-from-list: 'Remove';
  --l10n-no: 'No';
  --l10n-yes: 'Yes';
  --l10n-confirm-your-action: 'Confirm your action';
  --l10n-are-you-sure: 'Are you sure?';
  --l10n-selected-count: 'Selected:';
  --l10n-upload-error: 'Upload error';
  --l10n-no-files: 'No files selected';

  --l10n-src-type-local: 'Local file';
  --l10n-src-type-from-url: 'From URL';
  --l10n-src-type-camera: 'Camera';
  --l10n-src-type-draw: 'Draw';
  --l10n-src-type-facebook: 'Facebook';
  --l10n-src-type-dropbox: 'Dropbox';
  --l10n-src-type-gdrive: 'Gdrive';
  --l10n-src-type-gphotos: 'Gphotos';
  --l10n-src-type-instagram: 'Instagram';
  --l10n-src-type-flickr: 'Flickr';
  --l10n-src-type-vk: 'VK';
  --l10n-src-type-evernote: 'Evernote';
  --l10n-src-type-box: 'Box';
  --l10n-src-type-onedrive: 'Onedrive';
  --l10n-src-type-huddle: 'Huddle';
  --l10n-src-type-other: 'Other';

  --l10n-src-type: var(--l10n-src-type-local);

  --l10n-caption-from-url: 'Import from external URL';
  --l10n-caption-camera: 'Camera';
  --l10n-caption-draw: 'Draw';
  --l10n-caption-edit-file: 'Edit file';

  --l10n-file-no-name: 'No name...';

  --l10n-toggle-fullscreen: 'Toggle fullscreen';
  --l10n-toggle-guides: 'Toggle guides';
  --l10n-rotate: 'Rotate';
  --l10n-flip-vertical: 'Flip vertical';
  --l10n-flip-horizontal: 'Flip horizontal';
  --l10n-brightness: 'Brightness';
  --l10n-contrast: 'Contrast';
  --l10n-saturation: 'Saturation';
  --l10n-resize: 'Resize image';
  --l10n-crop: 'Crop';
  --l10n-select-color: 'Select color';
  --l10n-text: 'Text';
  --l10n-draw: 'Draw';
  --l10n-cancel-edit: 'Cancel edit';

  --l10n-tab-view: 'Preview';
  --l10n-tab-details: 'Details';

  --l10n-file-name: 'Name';
  --l10n-file-size: 'Size';
  --l10n-cdn-url: 'CDN URL';
  --l10n-file-size-unknown: 'Unknown';
}
```

That means you can create your own variant of any UI text or add any new text to your custom block.

CSS:
```css
.my-txt-v1 {
  --l10n-my-custom-txt: 'SOME TEXT 1';
  --l10n-my-custom-title: 'some title 1';
}
.my-txt-v2 {
  --l10n-my-custom-txt: 'SOME TEXT 2';
  --l10n-my-custom-title: 'some title 2';
}
```
JavaScript:
```javascript
import { UC } from '@uploadcare/upload-blocks';

class MyBlock extends UC.BlockComponent {};

MyBlock.template = /*html*/ `
<div l10n="title:my-custom-title">
  <span l10n="my-custom-txt"></span>
</div>
`;

MyBlock.reg('my-block');
```

HTML:
```html
...
<uc-my-block class="my-txt-v1"></uc-my-block>
...
<uc-my-block class="my-txt-v2"></uc-my-block>
...
```

To connect some text to the some HTML-element property in your block template, instead of `textContent`, use `:` symbol separating element property name and the text key: `<div l10n="title:my-custom-title">`.
