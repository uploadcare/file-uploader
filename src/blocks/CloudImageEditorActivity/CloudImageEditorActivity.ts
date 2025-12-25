import './cloud-image-editor-activity.css';
import { ActivityBlock } from '../../abstract/ActivityBlock';
import type { TypedData } from '../../abstract/TypedData';
import { UploaderBlock } from '../../abstract/UploaderBlock';
import type { uploadEntrySchema } from '../../abstract/uploadEntrySchema';
import { CloudImageEditorBlock } from '../CloudImageEditor/index';
import type { ApplyResult, ChangeResult } from '../CloudImageEditor/src/types';

export type ActivityParams = { internalId: string };

export class CloudImageEditorActivity extends UploaderBlock {
  override couldBeCtxOwner = true;
  override activityType = ActivityBlock.activities.CLOUD_IMG_EDIT;

  private _entry?: TypedData<typeof uploadEntrySchema>;
  private _instance?: CloudImageEditorBlock;

  override get activityParams(): ActivityParams {
    const params = super.activityParams;

    if ('internalId' in params) {
      return params;
    }
    throw new Error(`Cloud Image Editor activity params not found`);
  }

  override initCallback(): void {
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

  handleApply(e: CustomEvent<ApplyResult>): void {
    if (!this._entry) {
      return;
    }
    const result = e.detail;
    this._entry.setMultipleValues({
      cdnUrl: result.cdnUrl,
      cdnUrlModifiers: result.cdnUrlModifiers,
    });
    this.modalManager?.close(ActivityBlock.activities.CLOUD_IMG_EDIT);
    this.historyBack();
  }

  handleCancel(): void {
    this.modalManager?.close(ActivityBlock.activities.CLOUD_IMG_EDIT);
    this.historyBack();
  }

  mountEditor(): void {
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
      const customEvent = e as CustomEvent<ApplyResult>;
      this.handleApply(customEvent);
      this.debugPrint(`editor event "apply"`, customEvent.detail);
    });
    instance.addEventListener('cancel', (e) => {
      const customEvent = e as CustomEvent<void>;
      this.handleCancel();
      this.debugPrint(`editor event "cancel"`, customEvent.detail);
    });
    instance.addEventListener('change', (e) => {
      const customEvent = e as CustomEvent<ChangeResult>;
      this.debugPrint(`editor event "change"`, customEvent.detail);
    });

    this.innerHTML = '';
    this.appendChild(instance);

    this._instance = instance;
  }

  unmountEditor(): void {
    this._instance = undefined;
    this._entry = undefined;
    this.innerHTML = '';
  }
}
