import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { CloudImageEditorBlock } from '../CloudImageEditor/index.js';

export class CloudImageEditorActivity extends UploaderBlock {
  activityType = ActivityBlock.activities.CLOUD_IMG_EDIT;

  init$ = {
    ...this.init$,
    cdnUrl: null,
  };

  initCallback() {
    super.initCallback();

    this.registerActivity(this.activityType, {
      onActivate: () => this.mountEditor(),
      onDeactivate: () => this.unmountEditor(),
    });

    this.sub('*focusedEntry', (/** @type {import('../../abstract/TypedData.js').TypedData} */ entry) => {
      if (!entry) {
        return;
      }
      this.entry = entry;

      this.entry.subscribe('cdnUrl', (cdnUrl) => {
        if (cdnUrl) {
          this.$.cdnUrl = cdnUrl;
        }
      });
    });
  }

  /** @param {CustomEvent<import('./src/types.js').ApplyResult>} e */
  handleApply(e) {
    let result = e.detail;
    this.entry.setMultipleValues({
      cdnUrl: result.cdnUrl,
      cdnUrlModifiers: result.cdnUrlModifiers,
    });
    this.historyBack();
  }

  handleCancel() {
    this.historyBack();
  }

  mountEditor() {
    const instance = new CloudImageEditorBlock();
    const cdnUrl = this.$.cdnUrl;
    const cropPreset = this.cfg.cropPreset;

    instance.setAttribute('ctx-name', this.ctxName);
    instance.setAttribute('cdn-url', cdnUrl);

    if (cropPreset) {
      instance.setAttribute('crop-preset', cropPreset);
    }

    instance.addEventListener('apply', (result) => this.handleApply(result));
    instance.addEventListener('cancel', () => this.handleCancel());

    this.innerHTML = '';
    this.appendChild(instance);
  }

  unmountEditor() {
    this.innerHTML = '';
  }
}
