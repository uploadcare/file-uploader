import { html, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import type { CameraAudioMode, CameraAudioQuality, CameraResolution } from '../../types/exported';
import { canUsePermissionsApi } from '../../utils/abilities';
import { deserializeCsv } from '../../utils/comma-separated';
import { debounce } from '../../utils/debounce';
import { stringToArray } from '../../utils/stringToArray';
import { UID } from '../../utils/UID';
import { UploadSource } from '../../utils/UploadSource';
import { InternalEventType } from '../UploadCtxProvider/EventEmitter';
import './camera-source.css';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { centerCrop } from './aspectRatio';
import { audioBitsPerSecond, type BuildConstraintsInput, buildConstraints } from './buildConstraints';
import {
  AUDIO_MODES,
  AUDIO_QUALITIES,
  filterResolutionOptions,
  maxShortSideOf,
  NATIVE_ASPECT_RATIO,
  parseAspectRatioOptions,
  parseOptions,
  RESOLUTIONS,
  toRatio,
} from './cameraSettings';
import { CameraSourceEvents, CameraSourceTypes } from './constants';
import { createRecordingSource, type RecordingSource } from './recordingSource';
import { pickVideoMimeType, recordingFileType } from './videoFormat';

import '../ActivityHeader/ActivityHeader';
import '../Icon/Icon';
import '../Select/Select';

type CameraDeviceOption = { text: string; value: string };
type AudioDeviceOption = { text: string; value: string };

const DEFAULT_PERMISSIONS = ['camera', 'microphone'];

function formatTime(time: number): string {
  const minutes = Math.floor(time / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const DEFAULT_PICTURE_FORMAT = 'image/jpeg';

export type CameraMode = 'photo' | 'video';
export type CameraStatus = 'shot' | 'retake' | 'accept' | 'play' | 'stop' | 'pause' | 'resume';

export class CameraSource extends LitUploaderBlock {
  public override couldBeCtxOwner = true;
  private _unsubPermissions: (() => void) | null = null;

  private _capturing = false;

  private _chunks: BlobPart[] = [];

  private _mediaRecorder: MediaRecorder | null = null;

  /** What the recorder records: the camera stream, or a canvas that crops and mirrors it like a photo. */
  private _recordingSource: RecordingSource | null = null;

  /** The recording under review has its mirroring baked in, so the preview must not mirror it again. */
  @state()
  private _playbackMirrored = false;

  private _stream: MediaStream | null = null;

  @state()
  private _selectedAudioId: string | null = null;

  @state()
  private _selectedCameraId: string | null = null;

  @state()
  private _activeTab: CameraMode | null = null;
  private _options: MediaRecorderOptions = {};
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _cameraDevices: CameraDeviceOption[] = [];
  private _audioDevices: AudioDeviceOption[] = [];
  private _permissionResponses: Partial<Record<(typeof DEFAULT_PERMISSIONS)[number], PermissionStatus>> = {};
  private _permissionCleanupFns: Array<() => void> = [];
  private _currentVideoSource: MediaStream | null = null;

  // Both guard against a teardown: removing the playing preview fires `pause` after the context is gone, and an icon
  // re-rendering then can't reach its shared instances.
  private readonly _handlePreviewPlay = (): void => {
    if (!this.isConnected) return;
    this._startTimeline();
    this._currentTimelineIcon = 'pause';
  };

  private readonly _handlePreviewPause = (): void => {
    this._stopTimeline();
    if (!this.isConnected) return;
    this._currentTimelineIcon = 'play';
  };

  private _timerRef = createRef<HTMLElement>();
  private _lineRef = createRef<HTMLElement>();
  private _videoRef = createRef<HTMLVideoElement>();
  private _startTime = 0;
  private _elapsedTime = 0;

  @state()
  private _videoTransformCss: string | null = null;

  /**
   * The user's picks in the settings picker, as option values. `null` until the user picks, in which case the first
   * listed value applies; a config change clears them again. They never write back to the config.
   */
  @state()
  private _pickedAspectRatio: string | null = null;

  @state()
  private _pickedResolution: CameraResolution | null = null;

  @state()
  private _pickedAudioQuality: CameraAudioQuality | null = null;

  @state()
  private _pickedAudioMode: CameraAudioMode | null = null;

  /** The largest short side the open camera reports, to leave out resolutions it can't do. */
  @state()
  private _maxShortSide: number | null = null;

  private readonly _settingsPopoverId = `uc-camera-settings-${UID.generateFastUid()}`;

  @state()
  private _videoHidden = true;

  @state()
  private _messageHidden = true;

  @state()
  private _requestBtnHidden = canUsePermissionsApi();

  @state()
  private _cameraSelectOptions: CameraDeviceOption[] = [];

  @state()
  private _l10nMessage = '';

  @state()
  private _timerHidden = true;

  @state()
  private _cameraActionsHidden = true;

  /** The last permission state shown. Together with `_captureState`, it decides which controls are on screen. */
  @state()
  private _permissionState: 'granted' | 'denied' | 'prompt' = 'prompt';

  /** `live` while framing a shot, `recording` while recording, `review` while a photo or clip waits for retake or accept. */
  @state()
  private _captureState: 'live' | 'recording' | 'review' = 'live';

  @state()
  private _audioSelectOptions: AudioDeviceOption[] = [];

  @state()
  private _audioSelectDisabled = true;

  @state()
  private _audioToggleMicrophoneHidden = true;

  @state()
  private _currentIcon = 'camera-full';

  @state()
  private _currentTimelineIcon = 'play';

  @state()
  private _toggleMicrophoneIcon = 'microphone';

  @state()
  private _mutableClassButton = 'uc-shot-btn uc-camera-action';

  private _chooseActionWithCamera = () => {
    this.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'start-camera',
          node: this.tagName,
          tabId: this._activeTab,
          hasCustomConstraints: Boolean(this.cfg.cameraConstraints),
          aspectRatio: this._aspectRatioValue,
          resolution: this._resolution,
          audioQuality: this._audioQuality,
          audioMode: this._audioMode,
        },
      },
    });

    if (this._activeTab === CameraSourceTypes.PHOTO) {
      this._shot();
    }

    if (this._activeTab === CameraSourceTypes.VIDEO) {
      if (this._mediaRecorder?.state === 'recording') {
        this._stopRecording();
        return;
      }

      this._startRecording();
    }
  };

  private _handleCameraSelectChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    this._selectedCameraId = target.value;
    void this._capture();
  };

  private _handleAudioSelectChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    this._selectedAudioId = target.value;
    void this._applyAudioConstraints();
  };

  private _handleRequestPermissions = (): void => {
    void this._capture();
  };

  private _handleStartCamera = (): void => {
    this.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'shot-camera',
          node: this.tagName,
          tabId: this._activeTab,
          hasCustomConstraints: Boolean(this.cfg.cameraConstraints),
          aspectRatio: this._aspectRatioValue,
          resolution: this._resolution,
          audioQuality: this._audioQuality,
          audioMode: this._audioMode,
        },
      },
    });
    this._chooseActionWithCamera();
  };

  private _handleToggleRecording = (): void => {
    this._toggleRecording();
  };

  private _handleToggleAudio = (): void => {
    this._toggleEnableAudio();
  };

  private _handleRetake = (): void => {
    this.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'retake-camera',
          node: this.tagName,
          tabId: this._activeTab,
        },
      },
    });
    this._retake();
  };

  private _handleAccept = (): void => {
    this.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'accept-camera',
          node: this.tagName,
          tabId: this._activeTab,
        },
      },
    });
    this._accept();
  };

  private _handleClickTab = (event: MouseEvent): void => {
    const target = event.currentTarget as HTMLElement | null;
    const id = target?.getAttribute('data-id');
    if (id) {
      this._handleActiveTab(id as CameraMode);
    }
  };

  private _updateTimer = (): void => {
    const currentTime = Math.floor((performance.now() - this._startTime + this._elapsedTime) / 1000);

    if (typeof this.cfg.maxVideoRecordingDuration === 'number' && this.cfg.maxVideoRecordingDuration > 0) {
      const remainingTime = this.cfg.maxVideoRecordingDuration - currentTime;

      if (remainingTime <= 0) {
        const timer = this._timerRef.value as HTMLElement | undefined;
        if (timer) {
          timer.textContent = formatTime(remainingTime);
        }
        this._stopRecording();
        return;
      }

      const timer = this._timerRef.value as HTMLElement | undefined;
      if (timer) {
        timer.textContent = formatTime(remainingTime);
      }
    } else {
      const timer = this._timerRef.value as HTMLElement | undefined;
      if (timer) {
        timer.textContent = formatTime(currentTime);
      }
    }

    this._animationFrameId = requestAnimationFrame(this._updateTimer);
  };

  private _startTimer = (): void => {
    this._startTime = performance.now();
    this._elapsedTime = 0;

    this._updateTimer();
  };

  private _stopTimer = (): void => {
    if (this._animationFrameId) cancelAnimationFrame(this._animationFrameId);
  };

  private _startTimeline = (): void => {
    const video = this._videoRef.value as HTMLVideoElement | undefined;
    if (!video) {
      return;
    }
    const currentTime = video.currentTime;
    const duration = video.duration || 1;

    const line = this._lineRef.value as HTMLElement | undefined;
    if (line) {
      line.style.transform = `scaleX(${currentTime / duration})`;
    }
    const timer = this._timerRef.value as HTMLElement | undefined;
    if (timer) {
      timer.textContent = formatTime(currentTime);
    }
    this._animationFrameId = requestAnimationFrame(this._startTimeline);
  };

  private _stopTimeline = (): void => {
    if (this._animationFrameId) cancelAnimationFrame(this._animationFrameId);
  };

  private _animationFrameId: number | null = null;

  private _startRecording = (): void => {
    try {
      this._chunks = [];
      this._options = {
        ...this.cfg.mediaRecorderOptions,
      };
      const audioBits = audioBitsPerSecond(this.cfg.mediaRecorderOptions, this._audioQuality);
      if (audioBits !== undefined) {
        this._options.audioBitsPerSecond = audioBits;
      }

      const mimeType = pickVideoMimeType({
        explicit: this.cfg.mediaRecorderOptions?.mimeType,
        formats: this.cfg.cameraVideoFormats,
        isSupported: (type) => MediaRecorder.isTypeSupported(type),
      });
      if (mimeType) {
        this._options.mimeType = mimeType;
      } else {
        // An unsupported type would make the recorder throw: let the browser choose instead.
        delete this._options.mimeType;
      }

      const videoEl = this._videoRef.value;
      if (this._stream) {
        this._recordingSource = videoEl
          ? createRecordingSource({
              video: videoEl,
              stream: this._stream,
              aspectRatio: this._aspectRatio,
              mirror: this.cfg.cameraMirror,
            })
          : null;
        this._mediaRecorder = new MediaRecorder(this._recordingSource?.stream ?? this._stream, this._options);
        this._mediaRecorder.start();

        this._mediaRecorder.addEventListener('dataavailable', (event: BlobEvent) => {
          this._chunks.push(event.data);
        });

        this._startTimer();

        this.classList.add('uc-recording');
        this._setCameraState(CameraSourceEvents.PLAY);
      }
    } catch (error) {
      console.error('Failed to start recording', error);
      this.telemetryManager.sendEventError(error, 'camera recording. Failed to start recording');
    }
  };

  private _stopRecording = (): void => {
    this._mediaRecorder?.addEventListener('stop', () => {
      // Before the preview switches to the recording, or the canvas would start drawing the playback.
      this._stopRecordingSource();
      this._previewVideo();

      this._stopTimer();

      this._setCameraState(CameraSourceEvents.STOP);

      if (this._videoConstraintsPending) {
        void this._applyVideoConstraints();
      }
      if (this._audioConstraintsPending) {
        void this._applyAudioConstraints();
      }
    });

    this._mediaRecorder?.stop();
    this.classList.remove('uc-recording');

    this.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'stop-camera',
          node: this.tagName,
          tabId: this._activeTab,
        },
      },
    });
  };

  private _stopRecordingSource(): void {
    this._playbackMirrored = this._recordingSource?.mirrored ?? false;
    this._recordingSource?.stop();
    this._recordingSource = null;
  }

  /** This method is used to toggle recording pause/resume */
  private _toggleRecording = (): void => {
    if (this._mediaRecorder?.state === 'recording') return;

    const videoEl = this._videoRef.value;
    if (!videoEl) return;
    if (!videoEl.paused && !videoEl.ended && videoEl.readyState > 2) {
      videoEl.pause();
    } else if (videoEl.paused) {
      videoEl.play();
    }
  };

  private _toggleEnableAudio = (): void => {
    this._stream?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;

      this._toggleMicrophoneIcon = track.enabled ? 'microphone' : 'microphone-mute';
      this._audioSelectDisabled = !track.enabled;
    });
  };

  /**
   * Previewing the video that was recorded on the camera
   */
  private _previewVideo = (): void => {
    try {
      const blob = new Blob(this._chunks, {
        type: this._mediaRecorder?.mimeType,
      });

      const videoURL = URL.createObjectURL(blob);

      const videoElement = this._videoRef.value as HTMLVideoElement | undefined;
      if (!videoElement) {
        return;
      }

      videoElement.muted = false;
      videoElement.volume = 1;
      this._setVideoSource(null);
      videoElement.src = videoURL;

      this._attachPreviewListeners(videoElement);
    } catch (error) {
      console.error('Failed to preview video', error);
      this.telemetryManager.sendEventError(error, 'camera previewing. Failed to preview video');
    }
  };

  private _attachPreviewListeners(videoElement: HTMLVideoElement): void {
    this._detachPreviewListeners(videoElement);
    videoElement.addEventListener('play', this._handlePreviewPlay);
    videoElement.addEventListener('pause', this._handlePreviewPause);
  }

  private _detachPreviewListeners(videoElement?: HTMLVideoElement | null): void {
    videoElement?.removeEventListener('play', this._handlePreviewPlay);
    videoElement?.removeEventListener('pause', this._handlePreviewPause);
  }

  private _setVideoSource(stream: MediaStream | null): void {
    if (this._currentVideoSource === stream) {
      return;
    }
    this._currentVideoSource = stream;
    this._applyVideoSource();
  }

  /**
   * Do not bind srcObject directly in the template, because it stops video pausing on shot.
   * I really don'y know why but that's how it is. Assigning srcObject manually fixes the issue.
   */
  private _applyVideoSource(): void {
    const videoElement = this._videoRef.value;
    if (!videoElement) {
      return;
    }
    const nextSource = this._currentVideoSource ?? null;
    if (videoElement.srcObject !== nextSource) {
      videoElement.srcObject = nextSource;
    }
  }

  private _retake = (): void => {
    this._setCameraState(CameraSourceEvents.RETAKE);

    /** Reset video */
    if (this._activeTab === CameraSourceTypes.VIDEO) {
      this._setVideoSource(this._stream);
      const videoElement = this._videoRef.value as HTMLVideoElement | undefined;
      if (videoElement) {
        videoElement.muted = true;
      }
    }

    void this._videoRef.value?.play?.();
  };

  private _accept = (): void => {
    this._setCameraState(CameraSourceEvents.ACCEPT);

    if (this._activeTab === CameraSourceTypes.PHOTO) {
      this._canvas?.toBlob(
        (blob) => {
          if (!blob) {
            return;
          }
          const file = this._createFile('camera', 'jpeg', DEFAULT_PICTURE_FORMAT, blob);
          this._toSend(file);
        },
        DEFAULT_PICTURE_FORMAT,
        this.cfg.cameraPhotoQuality,
      );
      return;
    }

    const blob = new Blob(this._chunks, {
      type: this._mediaRecorder?.mimeType,
    });

    const ext = this._guessExtensionByMime(this._mediaRecorder?.mimeType);
    const file = this._createFile('video', ext, recordingFileType(this._mediaRecorder?.mimeType), blob);

    this._toSend(file);
    this._chunks = [];
  };

  private _handlePhoto = (status: CameraStatus): void => {
    if (status === CameraSourceEvents.SHOT) {
      this._captureState = 'review';
      this._cameraActionsHidden = false;
    }

    if (status === CameraSourceEvents.RETAKE || status === CameraSourceEvents.ACCEPT) {
      this._captureState = 'live';
      this._cameraActionsHidden = true;
    }
  };

  private _handleVideo = (status: CameraStatus): void => {
    if (status === CameraSourceEvents.PLAY) {
      this._captureState = 'recording';
      this._timerHidden = false;
      this._currentTimelineIcon = 'pause';
      this._currentIcon = 'square';
      this._mutableClassButton = 'uc-shot-btn uc-camera-action uc-stop-record';
    }

    if (status === CameraSourceEvents.STOP) {
      this._captureState = 'review';
      this._timerHidden = false;
      this._audioToggleMicrophoneHidden = true;
      this._cameraActionsHidden = false;
    }

    if (status === CameraSourceEvents.RETAKE || status === CameraSourceEvents.ACCEPT) {
      this._captureState = 'live';
      this._playbackMirrored = false;
      this._timerHidden = true;
      this._cameraActionsHidden = true;
      this._audioToggleMicrophoneHidden = !this.cfg.enableAudioRecording;
      this._currentIcon = 'video-camera-full';
      this._mutableClassButton = 'uc-shot-btn uc-camera-action';
    }
  };

  private _setCameraState = (status: CameraStatus): void => {
    if (
      this._activeTab === CameraSourceTypes.PHOTO &&
      (status === 'shot' || status === 'retake' || status === 'accept')
    ) {
      this._handlePhoto(status);
    }

    if (
      this._activeTab === CameraSourceTypes.VIDEO &&
      (status === 'play' ||
        status === 'stop' ||
        status === 'retake' ||
        status === 'accept' ||
        status === 'pause' ||
        status === 'resume')
    ) {
      this._handleVideo(status);
    }
  };

  private _shot(): void {
    this._setCameraState('shot');

    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');

    if (!this._ctx) {
      throw new Error('Failed to get canvas context');
    }
    const videoEl = this._videoRef.value;
    if (!videoEl) {
      throw new Error('Video element not found');
    }
    const crop = this._aspectRatio
      ? centerCrop(videoEl.videoWidth, videoEl.videoHeight, this._aspectRatio)
      : { x: 0, y: 0, width: videoEl.videoWidth, height: videoEl.videoHeight };
    this._canvas.height = crop.height;
    this._canvas.width = crop.width;

    // The crop is centered, so mirroring the canvas mirrors the crop too.
    if (this.cfg.cameraMirror) {
      this._ctx.translate(this._canvas.width, 0);
      this._ctx.scale(-1, 1);
    }

    this._ctx.drawImage(videoEl, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    // TODO: There are troubles with this, image isn't freezed after shot due to rendering in progress
    videoEl.pause();
  }

  private _handleActiveTab = (tabId: CameraMode): void => {
    if (tabId === CameraSourceTypes.PHOTO) {
      this._currentIcon = 'camera-full';
      this._audioToggleMicrophoneHidden = true;
    }

    if (tabId === CameraSourceTypes.VIDEO) {
      this._currentTimelineIcon = 'play';
      this._currentIcon = 'video-camera-full';
      this._audioToggleMicrophoneHidden = !this.cfg.enableAudioRecording;
    }

    this.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'camera-tab-switch',
          node: this.tagName,
          tabId,
        },
      },
    });

    this._activeTab = tabId;

    // Only the function form can differ between modes.
    if (typeof this.cfg.cameraConstraints === 'function') {
      void this._applyVideoConstraints();
      void this._applyAudioConstraints();
    }
  };

  private _createFile = (type: 'camera' | 'video', ext: string, format: string, blob: Blob): File => {
    const date = Date.now();
    const name = `${type}-${date}.${ext}`;

    const file = new File([blob], name, {
      lastModified: date,
      type: format,
    });

    return file;
  };

  private _guessExtensionByMime(mime: string | undefined): string {
    const knownContainers = {
      mp4: 'mp4',
      ogg: 'ogg',
      webm: 'webm',
      quicktime: 'mov',
      'x-matroska': 'mkv',
    };

    // MediaRecorder.mimeType returns empty string in Firefox.
    // Firefox record video as WebM now by default.
    // @link https://bugzilla.mozilla.org/show_bug.cgi?id=1512175
    if (mime === '') {
      return 'webm';
    }

    // e.g. "video/x-matroska;codecs=avc1,opus"
    if (mime) {
      const parts = mime.split('/');
      if (parts?.[0] === 'video') {
        const rest = parts.slice(1).join('/');
        const container = rest?.split(';')[0] as keyof typeof knownContainers | undefined;
        // e.g. "mkv"
        if (container && knownContainers[container]) {
          return knownContainers[container];
        }
      }
    }

    // In all other cases just return the base extension for all times
    return 'avi';
  }

  /**
   * The send file to the server
   */
  private _toSend = (file: File): void => {
    this.api.addFileFromObject(file, { source: UploadSource.CAMERA });

    this.routerLayer.navigateAfterFileAdd();
  };

  // Each of these options takes one value, or a list for a picker. The value in effect is the user's pick, else the
  // first listed value.

  private get _aspectRatioOptions(): string[] {
    return parseAspectRatioOptions(this.cfg.cameraAspectRatio);
  }

  /** The ratio option in effect, `native` for the camera's own shape. */
  private get _aspectRatioChoice(): string {
    return this._pickedAspectRatio ?? this._aspectRatioOptions[0] ?? NATIVE_ASPECT_RATIO;
  }

  /** Width / height in effect, or `null` for the camera's native shape. */
  private get _aspectRatio(): number | null {
    return toRatio(this._aspectRatioChoice) ?? null;
  }

  /** The listed resolutions the camera can do. */
  private get _resolutionOptions(): CameraResolution[] {
    return filterResolutionOptions(parseOptions(this.cfg.cameraResolution, RESOLUTIONS), this._maxShortSide);
  }

  /** A single value is a request rather than a picker option, so it applies even above what the camera reports. */
  private get _resolution(): CameraResolution {
    return (
      this._pickedResolution ??
      this._resolutionOptions[0] ??
      parseOptions(this.cfg.cameraResolution, RESOLUTIONS)[0] ??
      'auto'
    );
  }

  private get _audioQualityOptions(): CameraAudioQuality[] {
    return parseOptions(this.cfg.cameraAudioQuality, AUDIO_QUALITIES);
  }

  private get _audioQuality(): CameraAudioQuality {
    return this._pickedAudioQuality ?? this._audioQualityOptions[0] ?? 'auto';
  }

  private get _audioModeOptions(): CameraAudioMode[] {
    return parseOptions(this.cfg.cameraAudioMode, AUDIO_MODES);
  }

  private get _audioMode(): CameraAudioMode {
    return this._pickedAudioMode ?? this._audioModeOptions[0] ?? 'voice';
  }

  /** Audio pickers only matter where sound is recorded: the video tab, with audio recording on. */
  private get _isAudioPickerContext(): boolean {
    return this._activeTab === CameraSourceTypes.VIDEO && this.cfg.enableAudioRecording;
  }

  private get _isAspectRatioPickerHidden(): boolean {
    return this._aspectRatioOptions.length < 2;
  }

  private get _isResolutionPickerHidden(): boolean {
    return this._resolutionOptions.length < 2;
  }

  /** Unlike the other pickers this one needs no config: it offers the microphones there are, as the bottom bar did. */
  private get _isMicrophonePickerHidden(): boolean {
    return this._audioSelectOptions.length < 2 || !this._isAudioPickerContext;
  }

  private get _isAudioQualityPickerHidden(): boolean {
    return this._audioQualityOptions.length < 2 || !this._isAudioPickerContext;
  }

  private get _isAudioModePickerHidden(): boolean {
    return this._audioModeOptions.length < 2 || !this._isAudioPickerContext;
  }

  private get _isSettingsHidden(): boolean {
    return (
      this._permissionState !== 'granted' ||
      this._captureState !== 'live' ||
      (this._isAspectRatioPickerHidden &&
        this._isResolutionPickerHidden &&
        this._isMicrophonePickerHidden &&
        this._isAudioQualityPickerHidden &&
        this._isAudioModePickerHidden)
    );
  }

  private _handleAspectRatioPick = (event: Event): void => {
    const value = (event.target as { value?: string } | null)?.value;
    if (!value) return;
    this._pickedAspectRatio = value;
    this._sendSettingChange('aspectRatio', value);
    void this._applyVideoConstraints();
  };

  private _handleResolutionPick = (event: Event): void => {
    const value = (event.target as { value?: string } | null)?.value as CameraResolution | undefined;
    if (!value) return;
    this._pickedResolution = value;
    this._sendSettingChange('resolution', value);
    void this._applyVideoConstraints();
  };

  /** The bitrate is set when a recording starts, so there is nothing to apply until the next one. */
  private _handleAudioQualityPick = (event: Event): void => {
    const value = (event.target as { value?: string } | null)?.value as CameraAudioQuality | undefined;
    if (!value) return;
    this._pickedAudioQuality = value;
    this._sendSettingChange('audioQuality', value);
  };

  private _handleAudioModePick = (event: Event): void => {
    const value = (event.target as { value?: string } | null)?.value as CameraAudioMode | undefined;
    if (!value) return;
    this._pickedAudioMode = value;
    this._sendSettingChange('audioMode', value);
    void this._applyAudioConstraints();
  };

  private _audioQualityLabel(value: CameraAudioQuality): string {
    return value === 'auto' ? this.l10n('camera-setting-auto') : this.l10n(`camera-audio-quality-${value}`);
  }

  private _audioModeLabel(value: CameraAudioMode): string {
    return this.l10n(`camera-audio-mode-${value}`);
  }

  private _aspectRatioLabel(value: string): string {
    return value === NATIVE_ASPECT_RATIO ? this.l10n('camera-aspect-ratio-native') : value;
  }

  private _resolutionLabel(value: CameraResolution): string {
    return value === 'auto' ? this.l10n('camera-setting-auto') : value.toUpperCase();
  }

  private _sendSettingChange(
    setting: 'aspectRatio' | 'resolution' | 'audioQuality' | 'audioMode',
    value: string,
  ): void {
    this.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'camera-setting-change',
          node: this.tagName,
          tabId: this._activeTab,
          setting,
          value,
        },
      },
    });
  }

  /** The ratio in effect for telemetry: `''` for the native shape. */
  private get _aspectRatioValue(): string {
    return this._aspectRatioChoice === NATIVE_ASPECT_RATIO ? '' : this._aspectRatioChoice;
  }

  /** Photos and recordings are both cropped to the ratio, so the preview shows the same crop in either mode. */
  private get _isPreviewCropped(): boolean {
    return this._aspectRatio !== null;
  }

  private _isTabHidden(mode: CameraMode): boolean {
    return this._permissionState !== 'granted' || this._captureState !== 'live' || !this._cameraModes.includes(mode);
  }

  private get _isShutterHidden(): boolean {
    return this._permissionState !== 'granted' || this._captureState === 'review';
  }

  private get _isCameraSelectHidden(): boolean {
    return this._captureState !== 'live' || this._cameraSelectOptions.length <= 1;
  }

  private get _cameraModes(): CameraMode[] {
    return stringToArray(this.cfg.cameraModes).filter(
      (mode): mode is CameraMode => mode === CameraSourceTypes.PHOTO || mode === CameraSourceTypes.VIDEO,
    );
  }

  /** Only updates the UI; stopping the stream is always an explicit `_stopCapture()` call. */
  private _setPermissionsState = debounce((state: 'granted' | 'denied' | 'prompt') => {
    this.classList.toggle('uc-initialized', state === 'granted');
    this._permissionState = state;

    const visibleAudio = this._activeTab === CameraSourceTypes.VIDEO && this.cfg.enableAudioRecording;
    const currentIcon = this._activeTab === CameraSourceTypes.PHOTO ? 'camera-full' : 'video-camera-full';

    if (state === 'granted') {
      this._videoHidden = false;
      this._messageHidden = true;
      this._timerHidden = true;
      this._currentIcon = currentIcon;
      this._audioToggleMicrophoneHidden = !visibleAudio;
    } else if (state === 'prompt') {
      this._l10nMessage = 'camera-permissions-prompt';
      this._videoHidden = true;
      this._messageHidden = false;
    } else {
      this._l10nMessage = 'camera-permissions-denied';
      this._videoHidden = true;
      this._messageHidden = false;
      this._captureState = 'live';
      this._cameraActionsHidden = true;
      this._mutableClassButton = 'uc-shot-btn uc-camera-action';
    }
  }, 300);

  private _makeStreamInactive = (): boolean => {
    if (!this._stream) return false;

    const audioTracks = this._stream?.getAudioTracks();
    const videoTracks = this._stream?.getVideoTracks();

    audioTracks.forEach((track) => {
      track.stop();
    });
    videoTracks.forEach((track) => {
      track.stop();
    });

    return true;
  };

  /** The stream ended without us stopping it, e.g. the permission was revoked or the device was unplugged. */
  private _handleStreamInactive = (): void => {
    this._stopCapture();
    this._setPermissionsState('denied');
  };

  private _stopCapture = (): void => {
    if (this._capturing) {
      if (this._videoRef.value) {
        this._videoRef.value.volume = 0;
      }
      // Detach first: stopping the tracks ourselves must not be reported as an external stop.
      this._stream?.removeEventListener('inactive', this._handleStreamInactive);
      const tracks = this._currentVideoSource?.getTracks?.();
      tracks?.[0]?.stop();
      this._detachPreviewListeners(this._videoRef.value);
      this._setVideoSource(null);
      this._stopRecordingSource();

      this._makeStreamInactive();
      this._stream = null;
      this._stopTimer();

      this._capturing = false;
    }
  };

  /** Incremented on every `_capture()` call, so a slower, older `getUserMedia` call can tell it was superseded. */
  private _captureId = 0;

  /** The mode the camera is opening for: the active tab, or the tab that is about to become active. */
  private get _currentMode(): CameraMode {
    return this._activeTab ?? this._cameraModes[0] ?? CameraSourceTypes.PHOTO;
  }

  private get _constraintsInput(): BuildConstraintsInput {
    return {
      mode: this._currentMode,
      enableAudio: this.cfg.enableAudioRecording,
      audioMode: this._audioMode,
      aspectRatio: this._aspectRatio,
      resolution: this._resolution,
      custom: this.cfg.cameraConstraints,
      cameraId: this._selectedCameraId,
      audioId: this._selectedAudioId,
    };
  }

  /**
   * Opens the stream. If `cameraConstraints` asks for something the camera can't do, opens it once more without them
   * rather than showing the camera as denied.
   */
  private async _openStream(): Promise<{
    stream: MediaStream;
    requested: MediaTrackConstraints;
    requestedAudio: MediaStreamConstraints['audio'];
  }> {
    const input = this._constraintsInput;
    const constraints = buildConstraints(input);
    const requested = { requested: constraints.video, requestedAudio: constraints.audio };
    try {
      return { stream: await navigator.mediaDevices.getUserMedia(constraints), ...requested };
    } catch (error) {
      if (!input.custom || (error as Error | null)?.name !== 'OverconstrainedError') {
        throw error;
      }
      console.warn('The camera cannot satisfy cameraConstraints, opening it without them', error);
      this.telemetryManager.sendEventError(error, 'camera capturing. cameraConstraints could not be satisfied');

      const fallback = buildConstraints({ ...input, custom: null });
      // Reported as the original request, so the apply methods don't retry the same rejected constraints.
      return { stream: await navigator.mediaDevices.getUserMedia(fallback), ...requested };
    }
  }

  private _capture = async (): Promise<void> => {
    const captureId = ++this._captureId;

    // Mute the video to prevent feedback for Firefox
    if (this._videoRef.value) {
      this._videoRef.value.volume = 0;
    }

    // Many mobile devices can't open two cameras at once, so the old stream has to go before asking for the new one.
    this._stopCapture();

    try {
      this._setPermissionsState('prompt');
      const { stream, requested, requestedAudio } = await this._openStream();

      if (captureId !== this._captureId) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }

      this._stream = stream;
      this._requestedVideoConstraints = JSON.stringify(requested);
      this._requestedAudioConstraints = JSON.stringify(requestedAudio);
      this._stream.addEventListener('inactive', this._handleStreamInactive);

      this._setVideoSource(this._stream);
      this._capturing = true;
      this._setPermissionsState('granted');

      // Another camera may not do the picked preset: start the quality picker over if it's no longer offered.
      this._maxShortSide = maxShortSideOf(stream.getVideoTracks()[0]);
      if (this._pickedResolution !== null && !this._resolutionOptions.includes(this._pickedResolution)) {
        this._pickedResolution = null;
        void this._applyVideoConstraints();
      }
    } catch (error) {
      if (captureId !== this._captureId) {
        return;
      }
      this._setPermissionsState('denied');
      console.log('Failed to capture camera', error);
      this.telemetryManager.sendEventError(error, 'camera capturing. Failed to capture camera');
    }
  };

  /** The video constraints last asked of the open camera, serialized to compare against the next request. */
  private _requestedVideoConstraints: string | null = null;

  /** Set when the video constraints changed during a recording; they are applied once it stops. */
  private _videoConstraintsPending = false;

  /**
   * Applies changed video constraints to the open camera without reopening it, so there is no new permission prompt
   * and no black frame. Audio constraints need a new stream and wait for the next capture.
   */
  private _applyVideoConstraints = async (): Promise<void> => {
    const track = this._stream?.getVideoTracks()[0];
    if (!this._capturing || !track) {
      return;
    }
    if (this._mediaRecorder?.state === 'recording') {
      this._videoConstraintsPending = true;
      return;
    }
    this._videoConstraintsPending = false;

    const { video } = buildConstraints(this._constraintsInput);
    const serialized = JSON.stringify(video);
    if (serialized === this._requestedVideoConstraints) {
      return;
    }
    this._requestedVideoConstraints = serialized;

    try {
      await track.applyConstraints(video);
    } catch (error) {
      console.warn('The camera cannot satisfy cameraConstraints, keeping the current settings', error);
      this.telemetryManager.sendEventError(error, 'camera capturing. cameraConstraints could not be applied');
    }
  };

  /** The audio constraints last asked of the open microphone, serialized to compare against the next request. */
  private _requestedAudioConstraints: string | null = null;

  /** Set when the audio constraints changed during a recording; they are applied once it stops. */
  private _audioConstraintsPending = false;

  /**
   * Once the device list names the devices already in use, asking for them by id is the same request, not a change.
   * Without this, the first unrelated change would reopen the microphone for nothing.
   */
  private _syncRequestedConstraints(): void {
    const stream = this._stream;
    if (!this._capturing || !stream) {
      return;
    }
    const { video, audio } = buildConstraints(this._constraintsInput);
    if (this._selectedCameraId && this._selectedCameraId === stream.getVideoTracks()[0]?.getSettings().deviceId) {
      this._requestedVideoConstraints = JSON.stringify(video);
    }
    if (
      audio &&
      this._selectedAudioId &&
      this._selectedAudioId === stream.getAudioTracks()[0]?.getSettings().deviceId
    ) {
      this._requestedAudioConstraints = JSON.stringify(audio);
    }
  }

  /** Incremented on every microphone swap, so a slower, older one can tell it was superseded. */
  private _audioSwapId = 0;

  /**
   * Applies changed microphone settings by opening the microphone again and swapping its track into the stream; the
   * camera keeps running. A live track can't be changed instead: Chromium ignores processing changes on one and
   * refuses stereo.
   */
  private _applyAudioConstraints = async (): Promise<void> => {
    const stream = this._stream;
    if (!this._capturing || !stream || !this.cfg.enableAudioRecording) {
      return;
    }
    if (this._mediaRecorder?.state === 'recording') {
      this._audioConstraintsPending = true;
      return;
    }
    this._audioConstraintsPending = false;

    const { audio } = buildConstraints(this._constraintsInput);
    const serialized = JSON.stringify(audio);
    if (!audio || serialized === this._requestedAudioConstraints) {
      return;
    }
    this._requestedAudioConstraints = serialized;
    const swapId = ++this._audioSwapId;

    // The new microphone opens before the old one stops, so a failure keeps the sound that was working.
    let next: MediaStream;
    try {
      next = await navigator.mediaDevices.getUserMedia({ audio });
    } catch (error) {
      console.warn('Failed to apply the microphone settings, keeping the current ones', error);
      this.telemetryManager.sendEventError(error, 'camera capturing. Failed to reopen the microphone');
      return;
    }
    const [track] = next.getAudioTracks();
    if (swapId !== this._audioSwapId || this._stream !== stream || !track) {
      for (const stale of next.getTracks()) {
        stale.stop();
      }
      return;
    }

    const previous = stream.getAudioTracks();
    // A muted microphone stays muted.
    track.enabled = previous.every((old) => old.enabled);
    for (const old of previous) {
      stream.removeTrack(old);
      old.stop();
    }
    stream.addTrack(track);
  };

  private _handlePermissionsChange = (): void => {
    this._capture();
  };

  private _permissionAccess = async (): Promise<void> => {
    try {
      this._teardownPermissionListeners();
      for (const permission of DEFAULT_PERMISSIONS) {
        const response = await navigator.permissions.query({
          name: permission as PermissionName,
        });
        this._permissionResponses[permission] = response;

        response.addEventListener('change', this._handlePermissionsChange);
        this._permissionCleanupFns.push(() => {
          response.removeEventListener('change', this._handlePermissionsChange);
        });
      }
      this._unsubPermissions = () => {
        this._teardownPermissionListeners();
      };
    } catch (error) {
      this._teardownPermissionListeners();
      console.log('Failed to use permissions API. Fallback to manual request mode.', error);
      this.telemetryManager.sendEventError(error, 'camera permissions. Failed to use permissions API');
    }
  };

  private _teardownPermissionListeners(): void {
    if (this._permissionCleanupFns.length === 0) {
      return;
    }
    for (const cleanup of this._permissionCleanupFns) {
      cleanup();
    }
    this._permissionCleanupFns = [];
    this._unsubPermissions = null;
  }

  /**
   * Picks the option to show as selected: the current choice if that device is still there, otherwise the device the
   * open stream actually uses, otherwise the first one.
   */
  private _resolveSelectedId(
    options: Array<{ value: string }>,
    currentId: string | null,
    track: MediaStreamTrack | undefined,
  ): string | null {
    if (currentId && options.some((option) => option.value === currentId)) {
      return currentId;
    }
    const activeId = track?.getSettings().deviceId;
    if (activeId && options.some((option) => option.value === activeId)) {
      return activeId;
    }
    return options[0]?.value ?? null;
  }

  /** Device labels are only exposed once permission is granted, so this runs after a successful capture. */
  private _getDevices = async (): Promise<void> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      this._cameraDevices = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          text: device.label.trim() || `${this.l10n('caption-camera')} ${index + 1}`,
          value: device.deviceId,
        }));

      this._audioDevices = this.cfg.enableAudioRecording
        ? devices
            .filter((device) => device.kind === 'audioinput')
            .map((device) => ({
              text: device.label.trim(),
              value: device.deviceId,
            }))
        : [];

      this._cameraSelectOptions = this._cameraDevices;
      this._selectedCameraId = this._resolveSelectedId(
        this._cameraDevices,
        this._selectedCameraId,
        this._stream?.getVideoTracks()[0],
      );

      this._audioSelectOptions = this._audioDevices;
      this._selectedAudioId = this._resolveSelectedId(
        this._audioDevices,
        this._selectedAudioId,
        this._stream?.getAudioTracks()[0],
      );
      this._syncRequestedConstraints();
    } catch (error) {
      this.telemetryManager.sendEventError(error, 'camera devices. Failed to get devices');
      console.log('Failed to get devices', error);
    }
  };

  private _onActivate = async (): Promise<void> => {
    await this._permissionAccess();
    await this._capture();
    await this._getDevices();
    navigator.mediaDevices?.addEventListener('devicechange', this._getDevices);

    this._handleCameraModes(this._cameraModes);
  };

  private _onDeactivate = async (): Promise<void> => {
    if (this._unsubPermissions) {
      this._unsubPermissions();
    }

    // `_stopCapture()` detaches the `inactive` listener before stopping, so the UI is reset here in every browser.
    this._setPermissionsState('denied');

    this._stopCapture();
  };

  private _handleCameraModes = (cameraModes: CameraMode[]): void => {
    // The tabs are derived from `cameraModes`, which isn't reactive state.
    this.requestUpdate();

    const defaultTab = cameraModes[0];
    if (defaultTab && (!this._activeTab || !cameraModes.includes(this._activeTab))) {
      this._handleActiveTab(defaultTab);
    }
  };

  public override initCallback(): void {
    super.initCallback();

    this.subConfigValue('cameraMirror', (val) => {
      this._videoTransformCss = val ? 'scaleX(-1)' : null;
    });

    this.subConfigValue('enableAudioRecording', (val) => {
      this._audioToggleMicrophoneHidden = !val;
      this._audioSelectDisabled = !val;
    });

    this.subConfigValue('cameraConstraints', () => {
      void this._applyVideoConstraints();
      void this._applyAudioConstraints();
    });

    // A config change clears the user's pick, so the first listed value applies again. The values in effect are read
    // from the config while rendering, so each change also asks for a render: clearing a pick that was never made
    // changes no state.
    this.subConfigValue('cameraAudioQuality', () => {
      this._pickedAudioQuality = null;
      this.requestUpdate();
    });

    this.subConfigValue('cameraAudioMode', () => {
      this._pickedAudioMode = null;
      this.requestUpdate();
      void this._applyAudioConstraints();
    });

    this.subConfigValue('cameraResolution', () => {
      this._pickedResolution = null;
      this.requestUpdate();
      void this._applyVideoConstraints();
    });

    this.subConfigValue('cameraAspectRatio', () => {
      this._pickedAspectRatio = null;
      this.requestUpdate();
      void this._applyVideoConstraints();
    });

    this.subConfigValue('cameraModes', (val) => {
      if (!this.isConnected) return;
      const cameraModes = deserializeCsv(val);
      this._handleCameraModes(
        cameraModes.filter(
          (mode): mode is CameraMode => mode === CameraSourceTypes.PHOTO || mode === CameraSourceTypes.VIDEO,
        ),
      );
    });

    void this._onActivate();
  }

  public override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    this._applyVideoSource();
  }

  public override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    this._applyVideoSource();
  }

  private _destroy(): void {
    this._teardownPermissionListeners();
    navigator.mediaDevices?.removeEventListener('devicechange', this._getDevices);
    this._detachPreviewListeners(this._videoRef.value);
    this._setVideoSource(null);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();

    void this._onDeactivate();
    this._destroy();
  }

  public override render() {
    return html`
     <uc-activity-header>
        <button
          type="button"
          class="uc-mini-btn"
          @click=${this.$['*historyBack']}
          title=${this.l10n('back')}
        >
          <uc-icon name="back"></uc-icon>
        </button>
        <div ?hidden=${!this._isCameraSelectHidden}>
          <uc-icon name="camera"></uc-icon>
          <span>${this.l10n('caption-camera')}</span>
        </div>
        <uc-select
          class="uc-camera-select"
          .options=${this._cameraSelectOptions}
          .value=${this._selectedCameraId ?? ''}
          ?hidden=${this._isCameraSelectHidden}
          @change=${this._handleCameraSelectChange}
        >
        </uc-select>
        <button
          type="button"
          class="uc-mini-btn uc-close-btn"
          @click=${this.$['*closeModal']}
          title=${this.l10n('a11y-activity-header-button-close')}
          aria-label=${this.l10n('a11y-activity-header-button-close')}
        >
          <uc-icon name="close"></uc-icon>
        </button>
      </uc-activity-header>
      <div class="uc-content">
        <video
          muted
          autoplay
          playsinline
          class=${classMap({ 'uc-cropped': this._isPreviewCropped })}
          style=${styleMap({
            transform: this._playbackMirrored ? null : this._videoTransformCss,
            aspectRatio: this._isPreviewCropped ? String(this._aspectRatio) : null,
          })}
          ?hidden=${this._videoHidden}
          ${ref(this._videoRef)}
        ></video>
        <div class="uc-message-box" ?hidden=${this._messageHidden}>
          <span>${this.l10n(this._l10nMessage)}</span>
          <button
            type="button"
            @click=${this._handleRequestPermissions}
            ?hidden=${this._requestBtnHidden}
          >
            ${this.l10n('camera-permissions-request')}
          </button>
        </div>
      </div>

      <div class="uc-controls">
        <div class="uc-switcher" ?hidden=${!this._timerHidden}>
          <button
            data-id="photo"
            type="button"
            class=${classMap({
              'uc-switch': true,
              'uc-mini-btn': true,
              'uc-active': this._activeTab === CameraSourceTypes.PHOTO,
            })}
            aria-label=${this.l10n('src-type-mobile-photo-camera')}
            aria-pressed=${this._activeTab === CameraSourceTypes.PHOTO}
            @click=${this._handleClickTab}
            ?hidden=${this._isTabHidden(CameraSourceTypes.PHOTO)}
            data-testid="tab-photo"
          >
            <uc-icon name="camera"></uc-icon>
          </button>
          <button
            data-id="video"
            type="button"
            class=${classMap({
              'uc-switch': true,
              'uc-mini-btn': true,
              'uc-active': this._activeTab === CameraSourceTypes.VIDEO,
            })}
            aria-label=${this.l10n('src-type-mobile-video-camera')}
            aria-pressed=${this._activeTab === CameraSourceTypes.VIDEO}
            @click=${this._handleClickTab}
            ?hidden=${this._isTabHidden(CameraSourceTypes.VIDEO)}
            data-testid="tab-video"
          >
            <uc-icon name="video-camera"></uc-icon>
          </button>
        </div>

        <button
          class="uc-secondary-btn uc-recording-timer"
          @click=${this._handleToggleRecording}
          ?hidden=${this._timerHidden}
          data-testid="recording-timer"
        >
          <uc-icon name=${this._currentTimelineIcon}></uc-icon>
          <span ${ref(this._timerRef)}> 00:00 </span>
          <span ${ref(this._lineRef)} class="uc-line"></span>
        </button>

        <div
          class="uc-camera-actions uc-camera-action"
          ?hidden=${this._cameraActionsHidden}
        >
          <button
            type="button"
            class="uc-secondary-btn"
            @click=${this._handleRetake}
          >
            ${this.l10n('retake')}
          </button>
          <button
            type="button"
            class="uc-primary-btn"
            @click=${this._handleAccept}
            data-testid="accept"
          >
            ${this.l10n('accept')}
          </button>
        </div>

        <button
          type="button"
          data-testid="shot"
          aria-label=${this.l10n('camera-shot')}
          @click=${this._handleStartCamera}
          class=${this._mutableClassButton}
          ?hidden=${this._isShutterHidden}
        >
          <uc-icon name=${this._currentIcon}></uc-icon>
        </button>

        <div class="uc-select">
          <button
            type="button"
            class="uc-mini-btn uc-btn-microphone"
            @click=${this._handleToggleAudio}
            ?hidden=${this._audioToggleMicrophoneHidden}
            data-testid="toggle-microphone"
          >
            <uc-icon name=${this._toggleMicrophoneIcon}></uc-icon>
          </button>
          <button
            type="button"
            class="uc-mini-btn uc-camera-settings-btn"
            popovertarget=${this._settingsPopoverId}
            title=${this.l10n('camera-settings')}
            aria-label=${this.l10n('camera-settings')}
            ?hidden=${this._isSettingsHidden}
          >
            <uc-icon name="settings"></uc-icon>
          </button>
          <div id=${this._settingsPopoverId} class="uc-camera-settings" popover="auto">
            <label ?hidden=${this._isAspectRatioPickerHidden}>
              <span>${this.l10n('camera-aspect-ratio')}</span>
              <uc-select
                .options=${this._aspectRatioOptions.map((value) => ({ value, text: this._aspectRatioLabel(value) }))}
                .value=${this._aspectRatioChoice}
                @change=${this._handleAspectRatioPick}
              ></uc-select>
            </label>
            <label ?hidden=${this._isResolutionPickerHidden}>
              <span>${this.l10n('camera-resolution')}</span>
              <uc-select
                .options=${this._resolutionOptions.map((value) => ({ value, text: this._resolutionLabel(value) }))}
                .value=${this._resolution}
                @change=${this._handleResolutionPick}
              ></uc-select>
            </label>
            <label ?hidden=${this._isMicrophonePickerHidden}>
              <span>${this.l10n('camera-microphone')}</span>
              <uc-select
                class="uc-microphone-select"
                .options=${this._audioSelectOptions}
                .value=${this._selectedAudioId ?? ''}
                ?disabled=${this._audioSelectDisabled}
                @change=${this._handleAudioSelectChange}
              ></uc-select>
            </label>
            <label ?hidden=${this._isAudioQualityPickerHidden}>
              <span>${this.l10n('camera-audio-quality')}</span>
              <uc-select
                .options=${this._audioQualityOptions.map((value) => ({ value, text: this._audioQualityLabel(value) }))}
                .value=${this._audioQuality}
                @change=${this._handleAudioQualityPick}
              ></uc-select>
            </label>
            <label ?hidden=${this._isAudioModePickerHidden}>
              <span>${this.l10n('camera-audio-mode')}</span>
              <uc-select
                .options=${this._audioModeOptions.map((value) => ({ value, text: this._audioModeLabel(value) }))}
                .value=${this._audioMode}
                @change=${this._handleAudioModePick}
              ></uc-select>
            </label>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-camera-source': CameraSource;
  }
}
