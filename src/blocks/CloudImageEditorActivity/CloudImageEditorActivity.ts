import { html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { TypedData } from '../../abstract/TypedData';
import type { uploadEntrySchema } from '../../abstract/uploadEntrySchema';
import { LitActivityBlock } from '../../lit/LitActivityBlock';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import type { ApplyResult, ChangeResult } from '../CloudImageEditor/src/types';
import './cloud-image-editor-activity.css';

export type ActivityParams = { internalId: string };

type EditorTemplateConfig = {
  cdnUrl: string;
  cropPreset?: string;
  tabs?: string;
};

export class CloudImageEditorActivity extends LitUploaderBlock {
  public override couldBeCtxOwner = true;
  public override activityType = LitActivityBlock.activities.CLOUD_IMG_EDIT;

  private _entry?: TypedData<typeof uploadEntrySchema>;

  @state()
  private editorConfig: EditorTemplateConfig | null = null;

  public override get activityParams(): ActivityParams {
    const params = super.activityParams;
    if ('internalId' in params) {
      return params;
    }
    throw new Error(`Cloud Image Editor activity params not found`);
  }

  public override initCallback(): void {
    super.initCallback();

    this.registerActivity(this.activityType, {
      onActivate: () => this._mountEditor(),
      onDeactivate: () => this._unmountEditor(),
    });

    this.subConfigValue('cropPreset', (cropPreset) => {
      if (!this.editorConfig) {
        return;
      }
      const normalized = cropPreset || undefined;
      if (this.editorConfig.cropPreset === normalized) {
        return;
      }
      this.editorConfig = {
        ...this.editorConfig,
        cropPreset: normalized,
      };
    });

    this.subConfigValue('cloudImageEditorTabs', (tabs) => {
      if (!this.editorConfig) {
        return;
      }
      const normalized = tabs || undefined;
      if (this.editorConfig.tabs === normalized) {
        return;
      }
      this.editorConfig = {
        ...this.editorConfig,
        tabs: normalized,
      };
    });
  }

  private _handleApply(e: CustomEvent<ApplyResult>): void {
    if (!this._entry) {
      return;
    }
    this.debugPrint(`editor event "apply"`, e.detail);
    const result = e.detail;
    this._entry.setMultipleValues({
      cdnUrl: result.cdnUrl,
      cdnUrlModifiers: result.cdnUrlModifiers,
    });
    this.modalManager?.close(LitActivityBlock.activities.CLOUD_IMG_EDIT);
    this.historyBack();
  }

  private _handleCancel(event?: Event): void {
    const detail = event instanceof CustomEvent ? event.detail : undefined;
    this.debugPrint(`editor event "cancel"`, detail);
    this.modalManager?.close(LitActivityBlock.activities.CLOUD_IMG_EDIT);
    this.historyBack();
  }

  public handleChange(event: CustomEvent<ChangeResult>): void {
    this.debugPrint(`editor event "change"`, event.detail);
  }

  private _mountEditor(): void {
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
    this.editorConfig = this._createEditorConfig(cdnUrl);
  }

  private _unmountEditor(): void {
    this._entry = undefined;
    this.editorConfig = null;
  }

  public override render() {
    if (!this.editorConfig) {
      return nothing;
    }

    const { cdnUrl, cropPreset, tabs } = this.editorConfig;

    return html`
      <uc-cloud-image-editor
        cdn-url=${cdnUrl}
        crop-preset=${ifDefined(cropPreset)}
        tabs=${ifDefined(tabs)}
        @apply=${this._handleApply}
        @cancel=${this._handleCancel}
        @change=${this.handleChange}
      ></uc-cloud-image-editor>
    `;
  }

  private _createEditorConfig(cdnUrl: string): EditorTemplateConfig {
    const config: EditorTemplateConfig = { cdnUrl };
    const cropPreset = this.cfg.cropPreset;
    if (cropPreset) {
      config.cropPreset = cropPreset;
    }
    const tabs = this.cfg.cloudImageEditorTabs;
    if (tabs) {
      config.tabs = tabs;
    }
    return config;
  }
}
