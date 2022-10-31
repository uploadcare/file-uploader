# Events

## Upload flow events

- `LR_UPLOAD_START` — upload started for the file list selected by user
- `LR_REMOVE` — fired when one of uploaded items removed from uploading list
- `LR_UPLOAD_PROGRESS` — common upload progress for the list
- `LR_UPLOAD_FINISH` — uploading is finished
- `LR_UPLOAD_ERROR` — error ocurred during files uploading
- `LR_VALIDATION_ERROR` — file not passed the checks according to validation settings
- `LR_CLOUD_MODIFICATION` — image was modified via cloud API
- `LR_DATA_OUTPUT` — common data about uploads

You can catch all events in window scope:

```js
window.addEventListener('LR_UPLOAD_START', (e) => {
  console.log(e.detail);
});
```

To define what exact workflow caused an event, use the context name:

```html
...
<lr-file-uploader-regular ctx-name="UPLOADER_1"></lr-file-uploader-regular>
...
<lr-file-uploader-regular ctx-name="UPLOADER_2"></lr-file-uploader-regular>
...
```

```js
window.addEventListener('LR_UPLOAD_START', (e) => {
  if (e.detail.ctx === 'UPLOADER_1') {
    console.log('Uploading started in the FIRST uploader instance.', e.detail.data);
  } else if (e.detail.ctx === 'UPLOADER_2') {
    console.log('Uploading started in the SECOND uploader instance.', e.detail.data);
  }
});
```
