import { html, nothing, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { ActivityBlock } from '../../abstract/ActivityBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import type { UploadEntry } from '../../abstract/UploadEntry';
import type { ApplyResult, ChangeResult } from '../CloudImageEditor/src/types';
import './cloud-image-editor-activity.css';

import '../../solutions/cloud-image-editor/CloudImageEditor';

export type ActivityParams = { internalId: string };

type EditorTemplateConfig = {
  cdnUrl: string;
  cdnCname: string;
  cropPreset: string;
  tabs: string;
  testMode: boolean;
};

/**
 * v2-native cloud image editor activity. Replaces v1's `LitUploaderBlock`
 * subclass: pulls the upload entry from `controller.collection`, reads
 * config via `controller.config.get`, dispatches modal close + history
 * back via `controller.router`. No `LitBlock`, no `_sharedInstancesBag`,
 * no `modalManager`, no `historyBack`.
 */
export class CloudImageEditorActivity extends ActivityBlock {
  public override activityType = 'cloud-image-edit';

  private _entry: UploadEntry | null = null;

  @state()
  private _editorConfig: EditorTemplateConfig | null = null;

  protected override controllerReady(ctrl: UploaderController): void {
    this._mountEditor(ctrl);
  }

  protected override controllerReleased(): void {
    this._unmountEditor();
  }

  public override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    // Re-mount whenever the router's params point at a different entry
    // than the one we already mounted (covers a second edit on a
    // different file). Also handles the initial mount when params arrive
    // after the activity becomes active.
    const ctrl = this.uploaderOrNull;
    if (!ctrl || !this.hasAttribute('active')) return;
    const params = ctrl.router.params as Partial<ActivityParams>;
    const targetId = typeof params?.internalId === 'string' ? params.internalId : null;
    if (!targetId) return;
    if (this._entry?.internalId === targetId) return;
    this._mountEditor(ctrl);
  }

  private _mountEditor(ctrl: UploaderController): void {
    const params = ctrl.router.params as Partial<ActivityParams>;
    if (!params || typeof params.internalId !== 'string') {
      // Activity opened without an `internalId` — happens during the
      // initial render before the plugin's `setCurrentActivity` fires.
      // We'll re-mount when params arrive.
      return;
    }
    const entry = ctrl.collection.read(params.internalId);
    if (!entry) {
      console.error(`[uc-cloud-image-editor-activity] entry with internalId "${params.internalId}" not found`);
      return;
    }
    this._entry = entry;
    const cdnUrl = entry.getValue('cdnUrl');
    if (!cdnUrl) {
      console.error(`[uc-cloud-image-editor-activity] entry "${params.internalId}" has not finished uploading yet`);
      return;
    }
    this._editorConfig = this._buildConfig(ctrl, cdnUrl);
  }

  private _unmountEditor(): void {
    this._entry = null;
    this._editorConfig = null;
  }

  private _buildConfig(ctrl: UploaderController, cdnUrl: string): EditorTemplateConfig {
    const cfg = ctrl.config.values as {
      cdnCname?: string;
      cropPreset?: string;
      cloudImageEditorTabs?: string;
      testMode?: boolean;
    };
    return {
      cdnUrl,
      cdnCname: cfg.cdnCname ?? '',
      cropPreset: cfg.cropPreset ?? '',
      tabs: cfg.cloudImageEditorTabs ?? '',
      testMode: Boolean(cfg.testMode),
    };
  }

  private _handleApply = (e: CustomEvent<ApplyResult>): void => {
    const ctrl = this.uploaderOrNull;
    if (!ctrl) return;
    if (this._entry) {
      const result = e.detail;
      this._entry.setMultipleValues({
        cdnUrl: result.cdnUrl,
        cdnUrlModifiers: result.cdnUrlModifiers,
      });
    }
    // `back()` alone returns to the previous activity (upload-list for
    // the regular preset). Calling `closeModal()` first would push a
    // `null` onto history, leaving nothing for `back()` to navigate to.
    ctrl.router.back();
  };

  private _handleCancel = (): void => {
    const ctrl = this.uploaderOrNull;
    if (!ctrl) return;
    ctrl.router.back();
  };

  private _handleChange = (_event: CustomEvent<ChangeResult>): void => {
    // No-op — v1 only logged the event for debug. Surface here for
    // consumers that subscribe via `controller.events` if needed.
  };

  public override render() {
    if (!this._editorConfig) return nothing;
    const { cdnUrl, cdnCname, cropPreset, tabs, testMode } = this._editorConfig;
    return html`
      <uc-cloud-image-editor
        cdn-url=${cdnUrl}
        cdn-cname=${cdnCname}
        crop-preset=${ifDefined(cropPreset || undefined)}
        tabs=${ifDefined(tabs || undefined)}
        ?test-mode=${testMode}
        @apply=${this._handleApply}
        @cancel=${this._handleCancel}
        @change=${this._handleChange}
      ></uc-cloud-image-editor>
    `;
  }
}

if (!customElements.get('uc-cloud-image-editor-activity')) {
  customElements.define('uc-cloud-image-editor-activity', CloudImageEditorActivity);
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-cloud-image-editor-activity': CloudImageEditorActivity;
  }
}
