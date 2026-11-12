import { Signal } from '@lit-labs/signals';
import { html, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { type CameraMode, parseCameraModes } from '../../abstract/cameraModes';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { inject } from '../../abstract/di/inject';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ChildBlock } from '../../lit/ChildBlock';
import { effect } from '../../lit/effect';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import { canUsePermissionsApi } from '../../utils/abilities';
import { UploadSource } from '../../utils/UploadSource';
import { CameraSession } from './CameraSession';
import type { CameraSetting } from './CaptureSettings';
import type { CameraActionEvent } from './ui/CameraActionEvent';
import { CameraControls } from './ui/CameraControls';
import { CameraHeader } from './ui/CameraHeader';
import { CameraPreview } from './ui/CameraPreview';
import { CameraSettingsPopup } from './ui/CameraSettingsPopup';
import { deriveCameraView } from './ui/cameraView';
import { deriveSettingsView } from './ui/settingsView';
import './camera-source.css';

export type { CameraMode };

/**
 * The camera activity. `CameraSession` holds its state and does the work; this element lends it the lifetime, the
 * config and the ctx's services, and renders the session into `<uc-camera-header>`, `<uc-camera-preview>` and
 * `<uc-camera-controls>`.
 */
export class CameraSource extends ChildBlock {
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(RouterController) private readonly _router!: RouterController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;
  // Read from the session's accept handler, which runs post-adoption, so `@inject` resolves it safely.
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  /** The camera's own shape as the preview shows it, which the native ratio's icon draws. */
  @state() private _previewShape: { width: number; height: number } | null = null;
  private readonly _requestButtonHidden = canUsePermissionsApi();

  private readonly _session = new CameraSession({
    lifetime: {
      whileAdopted: (work, dispose) => this.whileAdopted(work, dispose),
      runTask: (task) => this.runTask(task),
      adoptionSignal: () => this.adoptionSignal,
    },
    // The settings the camera screen shows are tracked reads, so a render that reads them through the session
    // re-renders when they change.
    config: {
      audioEnabled: () => this._config.get('enableAudioRecording'),
      mirror: () => this._config.get('cameraMirror'),
      recorderOptions: () => this._config.get('mediaRecorderOptions'),
      maxRecordingSeconds: () => this._config.get('maxVideoRecordingDuration') ?? undefined,
      cameraModes: () => parseCameraModes(this._config.get('cameraModes')),
      videoFormats: () => this._config.get('cameraVideoFormats'),
      constraints: () => this._config.get('cameraConstraints'),
      aspectRatio: () => this._config.getTracked('cameraAspectRatio'),
      resolution: () => this._config.getTracked('cameraResolution'),
      photoQuality: () => this._config.get('cameraPhotoQuality'),
      audioQuality: () => this._config.getTracked('cameraAudioQuality'),
      audioMode: () => this._config.getTracked('cameraAudioMode'),
    },
    cameraLabel: (index) => `${this.l10n('caption-camera')} ${index + 1}`,
    navigate: (edge) => this._router.traverse(edge),
    addFile: (file) => this._api.addFileFromObject(file, { source: UploadSource.CAMERA }),
    track: (event, extra) => this._telemetry.sendActionEvent(event, this.tagName, extra),
    report: (level, message, error, context) => {
      this._log[level](message, error);
      this._telemetry.sendEventError(error, context);
    },
  });

  // The actions are the camera's own business, so they stop here rather than reach the page.
  private readonly _handleAction = (event: CameraActionEvent): void => {
    event.stopPropagation();
    const { action } = event;
    switch (action.type) {
      case 'video-element':
        this._session.previewVideo(action.video);
        break;
      case 'video-frame':
        this._session.previewFrame(action.ready);
        break;
      case 'preview-resize':
        this._previewShape = { width: action.width, height: action.height };
        break;
      default:
        this._session.handle(action);
    }
  };

  // Camera activation is adoption-scoped: it starts here and stops in `controllerReleased`, on disconnect and on ctx
  // release/re-adoption alike.
  protected override controllerReady(): void {
    this.runTask(() => this._session.activate(parseCameraModes(this._config.get('cameraModes'))));
  }

  protected override controllerReleased(): void {
    this._session.release();
  }

  // Picks the default tab when `cameraModes` changes. `beforeUpdate` fires it eagerly and synchronously on adoption,
  // before `controllerReady`'s awaited work runs, then again on change. What the modes show and hide is read in render.
  /** @internal */
  @effect({ beforeUpdate: true })
  protected _syncCameraModes(): void {
    if (!this.isConnected) return;
    const cameraModes = parseCameraModes(this._config.getTracked('cameraModes'));
    // Only `cameraModes` drives this; what a tab switch reads to re-apply constraints must not.
    Signal.subtle.untrack(() => this._session.selectDefaultTab(cameraModes));
  }

  /**
   * A change to a camera setting's option starts its picker over on the first listed value and applies it to the open
   * camera; `enableAudioRecording` adds or drops its microphone.
   * @internal
   */
  @subscription()
  protected _watchCameraSettings(): Unsubscribe[] {
    const settings = {
      cameraAspectRatio: 'aspectRatio',
      cameraResolution: 'resolution',
      cameraAudioQuality: 'audioQuality',
      cameraAudioMode: 'audioMode',
      cameraConstraints: 'constraints',
      enableAudioRecording: 'audioEnabled',
    } as const satisfies Record<string, CameraSetting | 'constraints' | 'audioEnabled'>;
    return Object.entries(settings).map(([key, setting]) =>
      this._config.observe(key as keyof typeof settings, () => this._session.configChanged(setting)),
    );
  }

  // Tracked under SignalWatcher like `render()`, so the host classes the camera's CSS reads follow the session's state.
  // `uc-recording` drops as stop is pressed, not when the clip arrives.
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const session = this._session;
    this.classList.toggle('uc-initialized', session.permission === 'granted');
    this.classList.toggle('uc-recording', session.phase === 'recording' && !session.recording.isStopping);
  }

  public override render() {
    const session = this._session;
    const audioEnabled = this._config.getTracked('enableAudioRecording');
    const view = deriveCameraView({
      permission: session.permission,
      failure: session.access.failure,
      phase: session.phase,
      tab: session.activeTab,
      cameraModes: parseCameraModes(this._config.getTracked('cameraModes')),
      audioEnabled,
      cameraCount: session.devices.cameras.length,
      microphoneCount: audioEnabled ? session.devices.microphones.length : 0,
      muted: session.feed.audioMuted,
      microphoneDenied: session.access.microphoneDenied,
    });
    const settings = deriveSettingsView({
      view,
      permission: session.permission,
      phase: session.phase,
      tab: session.activeTab,
      audioEnabled,
      devices: session.devices,
      settings: session.settings,
    });
    return html`
      <uc-camera-header @uc-internal:camera-action=${this._handleAction}></uc-camera-header>
      <uc-camera-preview
        .view=${view}
        .mirror=${this._config.getTracked('cameraMirror') && !session.playbackMirrored}
        .aspectRatio=${session.settings.aspectRatio}
        .requestButtonHidden=${this._requestButtonHidden}
        @uc-internal:camera-action=${this._handleAction}
      ></uc-camera-preview>
      <uc-camera-controls
        .view=${view}
        .activeTab=${session.activeTab}
        .settings=${settings.sections}
        .settingsHidden=${settings.hidden}
        .previewShape=${this._previewShape}
        .hasVideoFrame=${session.preview.hasVideoFrame}
        .timelineIcon=${session.review.timelineIcon}
        .clock=${session.clock}
        @uc-internal:camera-action=${this._handleAction}
      ></uc-camera-controls>
    `;
  }

  /** Registers the camera's parts with it, so a page that defines `<uc-camera-source>` gets the whole camera. */
  public static override reg(tagName: string): void {
    super.reg(tagName);
    CameraHeader.reg('uc-camera-header');
    CameraPreview.reg('uc-camera-preview');
    CameraControls.reg('uc-camera-controls');
    CameraSettingsPopup.reg('uc-camera-settings');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-camera-source': CameraSource;
  }
}
