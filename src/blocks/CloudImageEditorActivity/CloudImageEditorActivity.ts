import { ContextProvider } from '@lit/context';
import { html, nothing, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import type { ControllerContainer } from '../../abstract/di/ControllerContainer';
import { inject } from '../../abstract/di/inject';
import { PluginController } from '../../abstract/managers/plugin';
import type { TypedData } from '../../abstract/TypedData';
import { ActivityChildBlock } from '../../lit/ActivityChildBlock';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import { editorIconContext } from '../CloudImageEditor/src/EditorIcon';
import type { ApplyResult, ChangeResult } from '../CloudImageEditor/src/types';
import { renderResolvedIcon } from '../Icon/renderResolvedIcon';
import './cloud-image-editor-activity.css';
import type { Uid } from '../../abstract/Uid';
import type { UploadEntryData } from '../../abstract/uploadEntrySchema';

import '../../solutions/cloud-image-editor/CloudImageEditor';
import type { CloudImageEditorActivityParams } from '../../abstract/activity-constants';

export type ActivityParams = CloudImageEditorActivityParams;

export class CloudImageEditorActivity extends ActivityChildBlock {
  // `RouterController` is inherited as the base `ActivityChildBlock`'s
  // `protected _router` @inject field (its `[active]` toggle reads it, and this
  // block traverses on apply/cancel); `ConfigController` is added here for the
  // tracked `cropPreset` / `cloudImageEditorTabs` render reads that feed the
  // editor's attributes. `UploadCollectionController` (the entry source) can
  // race adoption, so it stays on `whenController` (see `_mountEditor`).
  @inject(ConfigController) private readonly _config!: ConfigController;

  private _entry?: TypedData<UploadEntryData>;

  // NEXT-MAJOR(editor-icons): the editor should own its icon set (sprite only, themed through its own props/CSS) and
  // not read the uploader's `iconHrefResolver` or plugin icons. Kept for 1.x compat: v1's editor rendered `uc-icon`,
  // so this hands `uc-editor-icon` the same resolution `uc-icon` does (plugin icon, then resolver, then sprite).
  // Only inside the uploader: the standalone editor keeps the sprite even next to a `<uc-config iconHrefResolver>`,
  // where v1 followed the resolver.
  private readonly _editorIcons = new ContextProvider(this, { context: editorIconContext });

  // Resolved through `whenController` as in `uc-icon`: the plugin manager is bound only once an uploader scope attaches.
  private _pluginManager: PluginController | null = null;

  // Mount marker: the resolved cdn url of the entry being edited, set once the
  // uploadCollection entry is available and cleared on unmount. Its presence
  // gates whether the `<uc-cloud-image-editor>` renders; `cropPreset` / `tabs`
  // are read reactively at render time (see `render`), not stored here.
  @state()
  private _cdnUrl: string | null = null;

  // The editor mount is adoption-scoped (the cdn-url marker is resolved by the
  // `@subscription _resolveEntry`), so reset it in `controllerReleased` — invoked
  // on disconnect (via the base `disconnectedCallback` → `_releaseController`)
  // and additionally on ctx release/re-adoption, which the old disconnect-only
  // path missed.
  protected override controllerReleased(container: ControllerContainer): void {
    super.controllerReleased(container);
    this._pluginManager = null;
    this._unmountEditor();
  }

  /** @internal */
  @subscription()
  protected _wirePluginIcons(): Unsubscribe {
    return this.container.whenController(PluginController, (pluginManager) => {
      this._pluginManager = pluginManager;
      this.requestUpdate();
      return pluginManager.onPluginsChange(() => this.requestUpdate());
    });
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);
    // Tracked read: a later `iconHrefResolver` change re-runs this and hands the editor icons a new renderer.
    const iconHrefResolver = this._config.getTracked('iconHrefResolver');
    const pluginIcons = this._pluginManager?.snapshot().icons;
    this._editorIcons.setValue((name) => renderResolvedIcon(name, pluginIcons, iconHrefResolver));
  }

  private _handleApply(e: CustomEvent<ApplyResult>): void {
    if (!this._entry) {
      return;
    }
    this._log.debug(`editor event "apply"`, e.detail);
    const result = e.detail;
    this._entry.setMany({
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

  // The uploader-scope `UploadCollectionController` resolves only once the scope
  // attaches (`ensureUploaderScope`), which can race this adoption — go through
  // `whenController` (fires now if resolved, else on resolution). `internalId`
  // comes from the router-params object, a per-activity contract (ExternalSource
  // precedent) rather than a runtime guard the router already enforces.
  /** @internal */
  @subscription()
  protected _resolveEntry(): Unsubscribe {
    const { internalId } = this._router.params as ActivityParams;
    return this.container.whenController(UploadCollectionController, (collection) => {
      const entry = collection.read(internalId as Uid);
      if (!entry) {
        throw new Error(`Entry with internalId "${internalId}" not found`);
      }
      this._entry = entry;
      const cdnUrl = this._entry.get('cdnUrl');
      if (!cdnUrl) {
        throw new Error(`Entry with internalId "${internalId}" hasn't uploaded yet`);
      }
      this._cdnUrl = cdnUrl;
    });
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
