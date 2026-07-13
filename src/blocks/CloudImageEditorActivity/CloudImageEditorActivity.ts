import { html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import type { TypedData } from '../../abstract/TypedData';
import { ActivityChildBlock } from '../../lit/ActivityChildBlock';
import { createDebugPrinter } from '../../lit/createDebugPrinter';
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

export class CloudImageEditorActivity extends ActivityChildBlock {
  private _entry?: TypedData<UploadEntryData>;

  @state()
  private _editorConfig: EditorTemplateConfig | null = null;

  /** Same contract as v1 `LitBlock.debugPrint` (`createDebugPrinter`), scoped to this ctx. */
  private _debugPrint = createDebugPrinter(() => this.bag.ctx, this.constructor.name);

  protected override controllerReady(ctrl: UploaderController): void {
    super.controllerReady(ctrl);

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

    this._mountEditor();
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unmountEditor();
  }

  private _handleApply(e: CustomEvent<ApplyResult>): void {
    if (!this._entry) {
      return;
    }
    this._debugPrint(`editor event "apply"`, e.detail);
    const result = e.detail;
    this._entry.setMultipleValues({
      cdnUrl: result.cdnUrl,
      cdnUrlModifiers: result.cdnUrlModifiers,
    });
    // The back intent closes the cloud-editor activity and returns to the
    // previous one.
    this.bag.router.traverse('onBack');
  }

  private _handleCancel(event?: Event): void {
    const detail = event instanceof CustomEvent ? event.detail : undefined;
    this._debugPrint(`editor event "cancel"`, detail);
    this.bag.router.traverse('onBack');
  }

  public handleChange(event: CustomEvent<ChangeResult>): void {
    this._debugPrint(`editor event "change"`, event.detail);
  }

  private _mountEditor(): void {
    // `internalId` comes from the router-params object, whose shape is a
    // per-activity contract (ExternalSource precedent) rather than a runtime
    // guard the router already enforces.
    const { internalId } = this.bag.router.params as ActivityParams;
    // The uploader-scope `*uploadCollection` instance may not have registered
    // yet when this block's controller adopts (controllerReady is an
    // adoption path) — go through `bag.when` rather than the throwing
    // `bag.uploadCollection` getter (FileItem/UploadList precedent).
    this.trackSub(
      this.bag.when('uploadCollection', (collection) => {
        const entry = collection.read(internalId as Uid);
        if (!entry) {
          throw new Error(`Entry with internalId "${internalId}" not found`);
        }
        this._entry = entry;
        const cdnUrl = this._entry.getValue('cdnUrl');
        if (!cdnUrl) {
          throw new Error(`Entry with internalId "${internalId}" hasn't uploaded yet`);
        }
        this._editorConfig = this._createEditorConfig(cdnUrl);
      }),
    );
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
      cropPreset: this.uploader.config.get('cropPreset'),
      tabs: this.uploader.config.get('cloudImageEditorTabs'),
    };
    return config;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-cloud-image-editor-activity': CloudImageEditorActivity;
  }
}
