import { Signal } from '@lit-labs/signals';
import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { NATIVE_ASPECT_RATIO, toRatio } from '../../abstract/camera/cameraSettings';
import { type CameraMode, CameraSourceTypes, parseCameraModes } from '../../abstract/cameraModes';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { inject } from '../../abstract/di/inject';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ChildBlock } from '../../lit/ChildBlock';
import { effect } from '../../lit/effect';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import type { CameraAudioMode, CameraAudioQuality, CameraResolution } from '../../types/exported';
import { canUsePermissionsApi } from '../../utils/abilities';
import { UploadSource } from '../../utils/UploadSource';
import { renderAspectRatioSvg } from '../Icon/aspectRatioIcon';
import type { CameraActionEvent, CameraSetting } from './CameraActionEvent';
import { CameraControls } from './CameraControls';
import { CameraHeader } from './CameraHeader';
import { CameraPreview } from './CameraPreview';
import { CameraSession } from './CameraSession';
import { type CameraSettingSection, CameraSettings } from './CameraSettings';
import { type CameraView, deriveCameraView } from './cameraView';
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
    const cameraModes = parseCameraModes(this._config.getTracked('cameraModes'));
    // Only `cameraModes` drives this; what a tab switch reads to re-apply constraints must not.
    Signal.subtle.untrack(() => this._session.selectDefaultTab(cameraModes));
  }

  /**
   * A change to a camera setting's option starts its picker over on the first listed value and applies it to the open
   * camera.
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
    } as const satisfies Record<string, CameraSetting | 'constraints'>;
    return Object.entries(settings).map(([key, setting]) =>
      this._config.observe(key as keyof typeof settings, () => this._session.configChanged(setting)),
    );
  }

  private _resolutionLabel(value: CameraResolution): string {
    return value === 'auto' ? this.l10n('camera-setting-auto') : value.toUpperCase();
  }

  private _audioQualityLabel(value: CameraAudioQuality): string {
    return value === 'auto' ? this.l10n('camera-setting-auto') : this.l10n(`camera-audio-quality-${value}`);
  }

  private _audioModeLabel(value: CameraAudioMode): string {
    return this.l10n(`camera-audio-mode-${value}`);
  }

  /** The shape of a ratio option; the native one takes the camera's, once its first frame is in. */
  private _aspectRatioIcon(value: string) {
    const ratio = toRatio(value);
    const shape = ratio ? { width: ratio, height: 1 } : this._session.previewShape;
    return shape ? html`<uc-icon>${renderAspectRatioSvg(shape.width, shape.height)}</uc-icon>` : undefined;
  }

  /** The settings popup's sections. Audio settings only matter where sound is recorded: video, with audio on. */
  private _settingSections(view: CameraView, audioEnabled: boolean): CameraSettingSection[] {
    const session = this._session;
    const audioContext = session.activeTab === CameraSourceTypes.VIDEO && audioEnabled;
    return [
      {
        key: 'camera',
        label: this.l10n('caption-camera'),
        hidden: view.cameraSelectHidden,
        options: session.cameras,
        value: session.selectedCameraId ?? '',
      },
      {
        key: 'aspectRatio',
        label: this.l10n('camera-aspect-ratio'),
        hidden: session.aspectRatioOptions.length < 2,
        options: session.aspectRatioOptions.map((value) => ({
          value,
          text: value === NATIVE_ASPECT_RATIO ? this.l10n('camera-aspect-ratio-native') : value,
          icon: this._aspectRatioIcon(value),
        })),
        value: session.aspectRatioChoice,
      },
      {
        key: 'resolution',
        label: this.l10n('camera-resolution'),
        hidden: session.resolutionOptions.length < 2,
        options: session.resolutionOptions.map((value) => ({ value, text: this._resolutionLabel(value) })),
        value: session.resolution,
      },
      {
        // Unlike the other pickers this one needs no config: it offers the microphones there are.
        key: 'microphone',
        label: this.l10n('camera-microphone'),
        hidden: view.audioSelectHidden,
        options: session.microphones,
        value: session.selectedMicrophoneId ?? '',
        disabled: view.audioSelectDisabled,
      },
      {
        key: 'audioQuality',
        label: this.l10n('camera-audio-quality'),
        hidden: session.audioQualityOptions.length < 2 || !audioContext,
        options: session.audioQualityOptions.map((value) => ({ value, text: this._audioQualityLabel(value) })),
        value: session.audioQuality,
      },
      {
        key: 'audioMode',
        label: this.l10n('camera-audio-mode'),
        hidden: session.audioModeOptions.length < 2 || !audioContext,
        options: session.audioModeOptions.map((value) => ({ value, text: this._audioModeLabel(value) })),
        value: session.audioMode,
      },
    ];
  }

  public override render() {
    const session = this._session;
    const audioEnabled = this._config.getTracked('enableAudioRecording');
    const view = deriveCameraView({
      permission: session.permission,
      failure: session.failure,
      phase: session.phase,
      tab: session.activeTab,
      cameraModes: parseCameraModes(this._config.getTracked('cameraModes')),
      audioEnabled,
      cameraCount: session.cameras.length,
      microphoneCount: audioEnabled ? session.microphones.length : 0,
      muted: session.audioMuted,
    });
    const settings = this._settingSections(view, audioEnabled);
    const settingsHidden =
      session.permission !== 'granted' || session.phase !== 'live' || settings.every((section) => section.hidden);
    return html`
      <uc-camera-header @uc-internal:camera-action=${this._handleAction}></uc-camera-header>
      <uc-camera-preview
        .view=${view}
        .mirror=${this._config.getTracked('cameraMirror') && !session.playbackMirrored}
        .aspectRatio=${session.aspectRatio}
        .requestButtonHidden=${this._requestButtonHidden}
        @uc-internal:camera-action=${this._handleAction}
        ${ref(this._previewRef)}
      ></uc-camera-preview>
      <uc-camera-controls
        .view=${view}
        .activeTab=${session.activeTab}
        .settings=${settings}
        .settingsHidden=${settingsHidden}
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
    CameraSettings.reg('uc-camera-settings');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-camera-source': CameraSource;
  }
}
