import { html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { TypedData } from '../../abstract/TypedData';
import { LitActivityBlock } from '../../lit/LitActivityBlock';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import type { ApplyResult, ChangeResult } from '../CloudImageEditor/src/types';
import './cloud-image-editor-activity.css';
import type { UploadEntryData } from '../../abstract/uploadEntrySchema';
import type { Uid } from '../../lit/Uid';

import '../../solutions/cloud-image-editor/CloudImageEditor';

export type ActivityParams = { internalId: string };

type EditorTemplateConfig = {
  cdnUrl: string;
  cropPreset: string;
  tabs: string;
};

export class CloudImageEditorActivity extends LitUploaderBlock {
  public override couldBeCtxOwner = true;
  public override activityType = LitActivityBlock.activities.CLOUD_IMG_EDIT;

  private _entry?: TypedData<UploadEntryData>;

  @state()
  private _editorConfig: EditorTemplateConfig | null = null;

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
      if (!this._editorConfig) {
        return;
      }
      if (this._editorConfig.cropPreset === cropPreset) {
        return;
      }
      this._editorConfig = {
        ...this._editorConfig,
        cropPreset,
      };
    });

    this.subConfigValue('cloudImageEditorTabs', (tabs) => {
      if (!this._editorConfig) {
        return;
      }
      if (this._editorConfig.tabs === tabs) {
        return;
      }
      this._editorConfig = {
        ...this._editorConfig,
        tabs,
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
    const entry = this.uploadCollection.read(internalId as Uid);
    if (!entry) {
      throw new Error(`Entry with internalId "${internalId}" not found`);
    }
    this._entry = entry;
    const cdnUrl = this._entry.getValue('cdnUrl');
    if (!cdnUrl) {
      throw new Error(`Entry with internalId "${internalId}" hasn't uploaded yet`);
    }
    this._editorConfig = this._createEditorConfig(cdnUrl);
  }

  private _unmountEditor(): void {
    this._entry = undefined;
    this._editorConfig = null;
  }

  public override render() {
    if (!this._editorConfig) {
      return nothing;
    }

    const { cdnUrl, cropPreset, tabs } = this._editorConfig;

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
    const config: EditorTemplateConfig = {
      cdnUrl,
      cropPreset: this.cfg.cropPreset,
      tabs: this.cfg.cloudImageEditorTabs,
    };
    return config;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-cloud-image-editor-activity': CloudImageEditorActivity;
  }
}
