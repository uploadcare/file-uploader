import { html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import type { ControllerContainer } from '../../abstract/di/ControllerContainer';
import { inject } from '../../abstract/di/inject';
import { logger } from '../../abstract/logger';
import type { TypedData } from '../../abstract/TypedData';
import { ActivityChildBlock } from '../../lit/ActivityChildBlock';
import type { ApplyResult, ChangeResult } from '../CloudImageEditor/src/types';
import './cloud-image-editor-activity.css';
import type { UploadEntryData } from '../../abstract/uploadEntrySchema';
import type { Uid } from '../../lit/Uid';

import '../../solutions/cloud-image-editor/CloudImageEditor';

export type ActivityParams = { internalId: string };

export class CloudImageEditorActivity extends ActivityChildBlock {
  // `RouterController` is inherited as the base `ActivityChildBlock`'s
  // `protected _router` @inject field (its `[active]` toggle reads it, and this
  // block traverses on apply/cancel); `ConfigController` is added here for the
  // tracked `cropPreset` / `cloudImageEditorTabs` render reads that feed the
  // editor's attributes. `UploadCollectionController` (the entry source) can
  // race adoption, so it stays on `whenController` (see `_mountEditor`).
  @inject(ConfigController) private readonly _config!: ConfigController;

  private _entry?: TypedData<UploadEntryData>;

  // Mount marker: the resolved cdn url of the entry being edited, set once the
  // uploadCollection entry is available and cleared on unmount. Its presence
  // gates whether the `<uc-cloud-image-editor>` renders; `cropPreset` / `tabs`
  // are read reactively at render time (see `render`), not stored here.
  @state()
  private _cdnUrl: string | null = null;

  /** Scoped debug logger; gated globally by the `debug` config option (see `LoggerConfigSync`). */
  private readonly _log = logger.scope(this.constructor.name);

  protected override controllerReady(container: ControllerContainer): void {
    super.controllerReady(container);
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
    this._log.debug(`editor event "apply"`, e.detail);
    const result = e.detail;
    this._entry.setMultipleValues({
      cdnUrl: result.cdnUrl,
      cdnUrlModifiers: result.cdnUrlModifiers,
    });
    // The back intent closes the cloud-editor activity and returns to the
    // previous one.
    this._router.traverse('onBack');
  }

  private _handleCancel(event?: Event): void {
    const detail = event instanceof CustomEvent ? event.detail : undefined;
    this._log.debug(`editor event "cancel"`, detail);
    this._router.traverse('onBack');
  }

  public handleChange(event: CustomEvent<ChangeResult>): void {
    this._log.debug(`editor event "change"`, event.detail);
  }

  private _mountEditor(): void {
    // `internalId` comes from the router-params object, whose shape is a
    // per-activity contract (ExternalSource precedent) rather than a runtime
    // guard the router already enforces.
    const { internalId } = this._router.params as ActivityParams;
    // The uploader-scope `UploadCollectionController` is resolved on the
    // container only once the uploader/solution block attaches its scope
    // (`ensureUploaderScope`), which can race this adoption path — go through
    // `whenController` (fires now if resolved, else on first resolution) rather
    // than the throwing `use(UploadCollectionController)`. Same
    // now-or-when-available semantics as the v1 `bag.when('uploadCollection')`.
    this.trackSub(
      this.container.whenController(UploadCollectionController, (collection) => {
        const entry = collection.read(internalId as Uid);
        if (!entry) {
          throw new Error(`Entry with internalId "${internalId}" not found`);
        }
        this._entry = entry;
        const cdnUrl = this._entry.getValue('cdnUrl');
        if (!cdnUrl) {
          throw new Error(`Entry with internalId "${internalId}" hasn't uploaded yet`);
        }
        this._cdnUrl = cdnUrl;
      }),
    );
  }

  private _unmountEditor(): void {
    this._entry = undefined;
    this._cdnUrl = null;
  }

  public override render() {
    if (this._cdnUrl === null) {
      return nothing;
    }

    // Render-feeding config reads through the TRACKED accessor: `SignalWatcher`
    // (on the `ChildBlock` base) auto-tracks these, so a `cropPreset` /
    // `cloudImageEditorTabs` config change while the editor is mounted re-renders
    // it with the new attributes — matching the v1
    // `subConfigValue('cropPreset' | 'cloudImageEditorTabs')` subscriptions this
    // replaces. While unmounted (`_cdnUrl === null`) nothing renders and nothing
    // tracks, mirroring the v1 `if (!this._editorConfig) return` guard.
    const config = this._config;
    const cropPreset = config.getTracked('cropPreset');
    const tabs = config.getTracked('cloudImageEditorTabs');

    return html`
      <uc-cloud-image-editor
        cdn-url=${this._cdnUrl}
        crop-preset=${ifDefined(cropPreset)}
        tabs=${ifDefined(tabs)}
        @apply=${this._handleApply}
        @cancel=${this._handleCancel}
        @change=${this.handleChange}
      ></uc-cloud-image-editor>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-cloud-image-editor-activity': CloudImageEditorActivity;
  }
}
