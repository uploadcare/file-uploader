import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { type CameraMode, parseCameraModes } from '../../abstract/cameraModes';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { inject } from '../../abstract/di/inject';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ChildBlock } from '../../lit/ChildBlock';
import { effect } from '../../lit/effect';
import { canUsePermissionsApi } from '../../utils/abilities';
import { UploadSource } from '../../utils/UploadSource';
import type { CameraActionEvent } from './CameraActionEvent';
import { CameraControls } from './CameraControls';
import { CameraHeader } from './CameraHeader';
import { CameraPreview } from './CameraPreview';
import { CameraSession } from './CameraSession';
import { deriveCameraView } from './cameraView';
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

  private readonly _previewRef = createRef<CameraPreview>();
  private readonly _controlsRef = createRef<CameraControls>();
  private readonly _requestButtonHidden = canUsePermissionsApi();

  private readonly _session = new CameraSession({
    whileAdopted: (work, dispose) => this.whileAdopted(work, dispose),
    runTask: (task) => this.runTask(task),
    adoptionSignal: () => this.adoptionSignal,
    config: {
      audioEnabled: () => this._config.get('enableAudioRecording'),
      mirror: () => this._config.get('cameraMirror'),
      recorderOptions: () => this._config.get('mediaRecorderOptions') ?? {},
      maxRecordingSeconds: () => this._config.get('maxVideoRecordingDuration') ?? undefined,
    },
    cameraLabel: (index) => `${this.l10n('caption-camera')} ${index + 1}`,
    video: () => this._previewRef.value?.video,
    timer: () => this._controlsRef.value?.timer,
    timeline: () => this._controlsRef.value?.timeline,
    setHostClass: (name, on) => this.classList.toggle(name, on),
    navigate: (edge) => this._router.traverse(edge),
    addFile: (file) => this._api.addFileFromObject(file, { source: UploadSource.CAMERA }),
    track: (event, extra) => this._telemetry.sendActionEvent(event, this.tagName, extra),
    report: (level, message, error, context) => {
      this._log[level](message, error);
      this._telemetry.sendEventError(error, context);
    },
  });

  private readonly _handleAction = (event: CameraActionEvent): void => {
    this._session.handle(event.action);
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
    this._session.selectDefaultTab(parseCameraModes(this._config.getTracked('cameraModes')));
  }

  public override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    this._session.syncVideo();
  }

  public override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    this._session.syncVideo();
  }

  public override render() {
    const session = this._session;
    const audioEnabled = this._config.getTracked('enableAudioRecording');
    const view = deriveCameraView({
      permission: session.permission,
      phase: session.phase,
      tab: session.activeTab,
      cameraModes: parseCameraModes(this._config.getTracked('cameraModes')),
      audioEnabled,
      cameraCount: session.cameras.length,
      microphoneCount: audioEnabled ? session.microphones.length : 0,
      muted: session.audioMuted,
    });
    return html`
      <uc-camera-header
        .pickCamera=${!view.cameraSelectHidden}
        .cameras=${session.cameras}
        .selectedCameraId=${session.selectedCameraId}
        @uc-internal:camera-action=${this._handleAction}
      ></uc-camera-header>
      <uc-camera-preview
        .view=${view}
        .mirror=${this._config.getTracked('cameraMirror')}
        .requestButtonHidden=${this._requestButtonHidden}
        @uc-internal:camera-action=${this._handleAction}
        ${ref(this._previewRef)}
      ></uc-camera-preview>
      <uc-camera-controls
        .view=${view}
        .activeTab=${session.activeTab}
        .microphones=${session.microphones}
        .selectedMicrophoneId=${session.selectedMicrophoneId}
        .hasVideoFrame=${session.hasVideoFrame}
        .timelineIcon=${session.timelineIcon}
        @uc-internal:camera-action=${this._handleAction}
        ${ref(this._controlsRef)}
      ></uc-camera-controls>
    `;
  }

  /** Registers the camera's parts with it, so a page that defines `<uc-camera-source>` gets the whole camera. */
  public static override reg(tagName: string): void {
    super.reg(tagName);
    CameraHeader.reg('uc-camera-header');
    CameraPreview.reg('uc-camera-preview');
    CameraControls.reg('uc-camera-controls');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-camera-source': CameraSource;
  }
}
