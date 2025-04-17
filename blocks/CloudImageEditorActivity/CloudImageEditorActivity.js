// @ts-check
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { CloudImageEditorBlock } from '../CloudImageEditor/index.js';

/** @typedef {{ internalId: string }} ActivityParams */

export class CloudImageEditorActivity extends UploaderBlock {
  couldBeCtxOwner = true;
  activityType = ActivityBlock.activities.CLOUD_IMG_EDIT;

  /**
   * @private
   * @type {import('../../abstract/TypedData.js').TypedData<
   *       import('../../abstract/uploadEntrySchema.js').uploadEntrySchema
   *     >
   *   | undefined}
   */
  _entry;

  /**
   * @private
   * @type {CloudImageEditorBlock | undefined}
   */
  _instance;

  /** @type {ActivityParams} */
  get activityParams() {
    const params = super.activityParams;
    if ('internalId' in params) {
      return params;
    }
    throw new Error(`Cloud Image Editor activity params not found`);
  }

  initCallback() {
    super.initCallback();

    this.registerActivity(this.activityType, {
      onActivate: () => this.mountEditor(),
      onDeactivate: () => this.unmountEditor(),
    });

    this.subConfigValue('cropPreset', (cropPreset) => {
      if (this._instance && this._instance.getAttribute('crop-preset') !== cropPreset) {
        this._instance.setAttribute('crop-preset', cropPreset);
      }
    });

    this.subConfigValue('cloudImageEditorTabs', (tabs) => {
      if (this._instance && this._instance.getAttribute('tabs') !== tabs) {
        this._instance.setAttribute('tabs', tabs);
      }
    });
  }

  /** @param {CustomEvent<import('../CloudImageEditor/src/types.js').ApplyResult>} e */
  handleApply(e) {
    if (!this._entry) {
      return;
    }
    let result = e.detail;
    this._entry.setMultipleValues({
      cdnUrl: result.cdnUrl,
      cdnUrlModifiers: result.cdnUrlModifiers,
    });
    this.modalManager.close(ActivityBlock.activities.CLOUD_IMG_EDIT);
    this.historyBack();
  }

  handleCancel() {
    this.modalManager.close(ActivityBlock.activities.CLOUD_IMG_EDIT);
    this.historyBack();
  }

  mountEditor() {
    const { internalId } = this.activityParams;
    const entry = this.uploadCollection.read(internalId);
    if (!entry) {
      throw new Error(`Entry with internalId "${internalId}" not found`);
    }
    this._entry = entry;
    const cdnUrl = this._entry.getValue('cdnUrl');
    if (!cdnUrl) {
      throw new Error(`Entry with internalId "${internalId}" hasn't uploaded yet`);
    }

    const instance = new CloudImageEditorBlock();
    const cropPreset = this.cfg.cropPreset;
    const tabs = this.cfg.cloudImageEditorTabs;

    instance.setAttribute('ctx-name', this.ctxName);
    instance.setAttribute('cdn-url', cdnUrl);

    if (cropPreset) {
      instance.setAttribute('crop-preset', cropPreset);
    }
    if (tabs) {
      instance.setAttribute('tabs', tabs);
    }

    instance.addEventListener('apply', (e) => {
      const customEvent = /** @type {CustomEvent<import('../CloudImageEditor/src/types.js').ApplyResult>} */ (e);
      this.handleApply(customEvent);
      this.debugPrint(`editor event "apply"`, customEvent.detail);
    });
    instance.addEventListener('cancel', (e) => {
      const customEvent = /** @type {CustomEvent<void>} */ (e);
      this.handleCancel();
      this.debugPrint(`editor event "cancel"`, customEvent.detail);
    });
    instance.addEventListener('change', (e) => {
      const customEvent = /** @type {CustomEvent<import('../CloudImageEditor/src/types.js').ChangeResult>} */ (e);
      this.debugPrint(`editor event "change"`, customEvent.detail);
    });

    this.innerHTML = '';
    this.appendChild(instance);

    this._instance = instance;
  }

  unmountEditor() {
    this._instance = undefined;
    this._entry = undefined;
    this.innerHTML = '';
  }
}
