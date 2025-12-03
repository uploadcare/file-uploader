import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { LitActivityBlock } from '../../lit/LitActivityBlock';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import { canUsePermissionsApi } from '../../utils/abilities';
import { deserializeCsv } from '../../utils/comma-separated';
import { debounce } from '../../utils/debounce';
import { stringToArray } from '../../utils/stringToArray';
import { UploadSource } from '../../utils/UploadSource';
import { InternalEventType } from '../UploadCtxProvider/EventEmitter';
import './camera-source.css';
import { createRef, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { CameraSourceEvents, CameraSourceTypes } from './constants';

type CameraDeviceOption = { text: string; value: string };
type AudioDeviceOption = { text: string; value: string };

const DEFAULT_VIDEO_CONFIG = {
  width: {
    ideal: 1920,
  },
  height: {
    ideal: 1080,
  },
  frameRate: {
    ideal: 30,
  },
};

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
const DEFAULT_VIDEO_FORMAT = 'video/webm';

export type CameraMode = 'photo' | 'video';
export type CameraStatus = 'shot' | 'retake' | 'accept' | 'play' | 'stop' | 'pause' | 'resume';

export class CameraSource extends LitUploaderBlock {
  override couldBeCtxOwner = true;
  override activityType = LitActivityBlock.activities.CAMERA;

  private _unsubPermissions: (() => void) | null = null;

  private _capturing = false;

  private _chunks: BlobPart[] = [];

  private _mediaRecorder: MediaRecorder | null = null;

  private _stream: MediaStream | null = null;

  private _selectedAudioId: string | null = null;

  private _selectedCameraId: string | null = null;

  private _activeTab: CameraMode | null = null;
  private _options: MediaRecorderOptions = {};
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _cameraDevices: CameraDeviceOption[] = [];
  private _audioDevices: AudioDeviceOption[] = [];
  private _permissionResponses: Partial<Record<(typeof DEFAULT_PERMISSIONS)[number], PermissionStatus>> = {};
  private _permissionCleanupFns: Array<() => void> = [];
  private _currentVideoSource: MediaStream | null = null;

  private readonly _handlePreviewPlay = (): void => {
    this._startTimeline();
    this.currentTimelineIcon = 'pause';
  };

  private readonly _handlePreviewPause = (): void => {
    this.currentTimelineIcon = 'play';
    this._stopTimeline();
  };

  private timerRef = createRef<HTMLElement>();
  private lineRef = createRef<HTMLElement>();
  private videoRef = createRef<HTMLVideoElement>();
  private switcherRef = createRef<HTMLElement>();
  private _startTime = 0;
  private _elapsedTime = 0;

  @state()
  protected videoTransformCss: string | null = null;

  @state()
  protected videoHidden = true;

  @state()
  protected messageHidden = true;

  @state()
  protected requestBtnHidden = canUsePermissionsApi();

  @state()
  protected cameraSelectOptions: CameraDeviceOption[] = [];

  @state()
  protected cameraSelectHidden = true;

  @state()
  protected l10nMessage = '';

  @state()
  protected timerHidden = true;

  @state()
  protected cameraHidden = true;

  @state()
  protected cameraActionsHidden = true;

  @state()
  protected audioSelectOptions: AudioDeviceOption[] = [];

  @state()
  protected audioSelectHidden = true;

  @state()
  protected audioSelectDisabled = true;

  @state()
  protected audioToggleMicrophoneHidden = true;

  @state()
  protected tabCameraHidden = true;

  @state()
  protected tabVideoHidden = true;

  @state()
  protected currentIcon = 'camera-full';

  @state()
  protected currentTimelineIcon = 'play';

  @state()
  protected toggleMicrophoneIcon = 'microphone';

  @state()
  protected mutableClassButton = 'uc-shot-btn uc-camera-action';

  _chooseActionWithCamera = () => {
    this.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'start-camera',
          node: this.tagName,
          tabId: this._activeTab,
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
    void this._capture();
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

  _updateTimer = (): void => {
    const currentTime = Math.floor((performance.now() - this._startTime + this._elapsedTime) / 1000);

    if (typeof this.cfg.maxVideoRecordingDuration === 'number' && this.cfg.maxVideoRecordingDuration > 0) {
      const remainingTime = this.cfg.maxVideoRecordingDuration - currentTime;

      if (remainingTime <= 0) {
        const timer = this.timerRef.value as HTMLElement | undefined;
        if (timer) {
          timer.textContent = formatTime(remainingTime);
        }
        this._stopRecording();
        return;
      }

      const timer = this.timerRef.value as HTMLElement | undefined;
      if (timer) {
        timer.textContent = formatTime(remainingTime);
      }
    } else {
      const timer = this.timerRef.value as HTMLElement | undefined;
      if (timer) {
        timer.textContent = formatTime(currentTime);
      }
    }

    this._animationFrameId = requestAnimationFrame(this._updateTimer);
  };

  _startTimer = (): void => {
    this._startTime = performance.now();
    this._elapsedTime = 0;

    this._updateTimer();
  };

  _stopTimer = (): void => {
    if (this._animationFrameId) cancelAnimationFrame(this._animationFrameId);
  };

  _startTimeline = (): void => {
    const video = this.videoRef.value as HTMLVideoElement | undefined;
    if (!video) {
      return;
    }
    const currentTime = video.currentTime;
    const duration = video.duration || 1;

    const line = this.lineRef.value as HTMLElement | undefined;
    if (line) {
      line.style.transform = `scaleX(${currentTime / duration})`;
    }
    const timer = this.timerRef.value as HTMLElement | undefined;
    if (timer) {
      timer.textContent = formatTime(currentTime);
    }
    this._animationFrameId = requestAnimationFrame(this._startTimeline);
  };

  _stopTimeline = (): void => {
    if (this._animationFrameId) cancelAnimationFrame(this._animationFrameId);
  };

  _animationFrameId: number | null = null;

  _startRecording = (): void => {
    try {
      this._chunks = [];
      this._options = {
        ...this.cfg.mediaRecorderOptions,
      };

      const { mimeType } = this.cfg.mediaRecorderOptions || {};

      if (mimeType && MediaRecorder.isTypeSupported(mimeType)) {
        this._options.mimeType = mimeType;
      } else if (MediaRecorder.isTypeSupported(DEFAULT_VIDEO_FORMAT)) {
        this._options.mimeType = DEFAULT_VIDEO_FORMAT;
      } else {
        this._options.mimeType = 'video/mp4';
      }

      if (this._stream) {
        this._mediaRecorder = new MediaRecorder(this._stream, this._options);
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
      this._previewVideo();

      this._stopTimer();

      this._setCameraState(CameraSourceEvents.STOP);
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

  /** This method is used to toggle recording pause/resume */
  _toggleRecording = (): void => {
    if (this._mediaRecorder?.state === 'recording') return;

    const videoEl = this.videoRef.value;
    if (!videoEl) return;
    if (!videoEl.paused && !videoEl.ended && videoEl.readyState > 2) {
      videoEl.pause();
    } else if (videoEl.paused) {
      videoEl.play();
    }
  };

  _toggleEnableAudio = (): void => {
    this._stream?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;

      this.toggleMicrophoneIcon = track.enabled ? 'microphone' : 'microphone-mute';
      this.audioSelectDisabled = !track.enabled;
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

      const videoElement = this.videoRef.value as HTMLVideoElement | undefined;
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
    const videoElement = this.videoRef.value;
    if (!videoElement) {
      return;
    }
    const nextSource = this._currentVideoSource ?? null;
    if (videoElement.srcObject !== nextSource) {
      videoElement.srcObject = nextSource;
    }
  }

  _retake = (): void => {
    this._setCameraState(CameraSourceEvents.RETAKE);

    /** Reset video */
    if (this._activeTab === CameraSourceTypes.VIDEO) {
      this._setVideoSource(this._stream);
      const videoElement = this.videoRef.value as HTMLVideoElement | undefined;
      if (videoElement) {
        videoElement.muted = true;
      }
    }

    void this.videoRef.value?.play?.();
  };

  _accept = (): void => {
    this._setCameraState(CameraSourceEvents.ACCEPT);

    if (this._activeTab === CameraSourceTypes.PHOTO) {
      this._canvas?.toBlob((blob) => {
        if (!blob) {
          return;
        }
        const file = this._createFile('camera', 'jpeg', DEFAULT_PICTURE_FORMAT, blob);
        this._toSend(file);
      }, DEFAULT_PICTURE_FORMAT);
      return;
    }

    const blob = new Blob(this._chunks, {
      type: this._mediaRecorder?.mimeType,
    });

    const ext = this._guessExtensionByMime(this._mediaRecorder?.mimeType);
    const file = this._createFile('video', ext, `video/${ext}`, blob);

    this._toSend(file);
    this._chunks = [];
  };

  _handlePhoto = (status: CameraStatus): void => {
    if (status === CameraSourceEvents.SHOT) {
      this.tabVideoHidden = true;
      this.cameraHidden = true;
      this.tabCameraHidden = true;
      this.cameraActionsHidden = false;
      this.cameraSelectHidden = true;
    }

    if (status === CameraSourceEvents.RETAKE || status === CameraSourceEvents.ACCEPT) {
      this.tabVideoHidden = !this._cameraModes.includes(CameraSourceTypes.VIDEO);
      this.tabCameraHidden = !this._cameraModes.includes(CameraSourceTypes.PHOTO);
      this.cameraHidden = false;
      this.cameraActionsHidden = true;
      this.cameraSelectHidden = this._cameraDevices.length <= 1;
    }
  };

  _handleVideo = (status: CameraStatus): void => {
    if (status === CameraSourceEvents.PLAY) {
      this.timerHidden = false;
      this.tabCameraHidden = true;
      this.cameraSelectHidden = true;
      this.audioSelectHidden = true;
      this.currentTimelineIcon = 'pause';
      this.currentIcon = 'square';
      this.mutableClassButton = 'uc-shot-btn uc-camera-action uc-stop-record';
    }

    if (status === CameraSourceEvents.STOP) {
      this.timerHidden = false;
      this.cameraHidden = true;
      this.audioToggleMicrophoneHidden = true;
      this.cameraActionsHidden = false;
    }

    if (status === CameraSourceEvents.RETAKE || status === CameraSourceEvents.ACCEPT) {
      this.timerHidden = true;
      this.tabVideoHidden = !this._cameraModes.includes(CameraSourceTypes.VIDEO);
      this.tabCameraHidden = !this._cameraModes.includes(CameraSourceTypes.PHOTO);
      this.cameraHidden = false;
      this.cameraActionsHidden = true;
      this.audioToggleMicrophoneHidden = !this.cfg.enableAudioRecording;
      this.currentIcon = 'video-camera-full';
      this.mutableClassButton = 'uc-shot-btn uc-camera-action';
      this.audioSelectHidden = !this.cfg.enableAudioRecording || this._audioDevices.length <= 1;
      this.cameraSelectHidden = this._cameraDevices.length <= 1;
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
    const videoEl = this.videoRef.value;
    if (!videoEl) {
      throw new Error('Video element not found');
    }
    this._canvas.height = videoEl.videoHeight;
    this._canvas.width = videoEl.videoWidth;

    if (this.cfg.cameraMirror) {
      this._ctx.translate(this._canvas.width, 0);
      this._ctx.scale(-1, 1);
    }

    this._ctx.drawImage(videoEl, 0, 0);
    // TODO: There are troubles with this, image isn't freezed after shot due to rendering in progress
    videoEl.pause();
  }

  private _handleActiveTab = (tabId: CameraMode): void => {
    const switcher = this.switcherRef.value as HTMLElement | undefined;
    switcher?.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('uc-active', btn.getAttribute('data-id') === tabId);
    });

    if (tabId === CameraSourceTypes.PHOTO) {
      this.currentIcon = 'camera-full';
      this.audioSelectHidden = true;
      this.audioToggleMicrophoneHidden = true;
    }

    if (tabId === CameraSourceTypes.VIDEO) {
      this.currentTimelineIcon = 'play';
      this.currentIcon = 'video-camera-full';
      this.audioSelectHidden = !this.cfg.enableAudioRecording || this._audioDevices.length <= 1;
      this.audioToggleMicrophoneHidden = !this.cfg.enableAudioRecording;
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

  _guessExtensionByMime(mime: string | undefined): string {
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
  _toSend = (file: File): void => {
    this.api.addFileFromObject(file, { source: UploadSource.CAMERA });
    this.set$({
      '*currentActivity': LitActivityBlock.activities.UPLOAD_LIST,
    });
    this.modalManager?.open(LitActivityBlock.activities.UPLOAD_LIST);
  };

  private get _cameraModes(): CameraMode[] {
    return stringToArray(this.cfg.cameraModes).filter(
      (mode): mode is CameraMode => mode === CameraSourceTypes.PHOTO || mode === CameraSourceTypes.VIDEO,
    );
  }

  private _setPermissionsState = debounce((state: 'granted' | 'denied' | 'prompt') => {
    this.classList.toggle('uc-initialized', state === 'granted');

    const visibleAudio = this._activeTab === CameraSourceTypes.VIDEO && this.cfg.enableAudioRecording;
    const currentIcon = this._activeTab === CameraSourceTypes.PHOTO ? 'camera-full' : 'video-camera-full';

    if (state === 'granted') {
      this.videoHidden = false;
      this.cameraHidden = false;
      this.tabCameraHidden = !this._cameraModes.includes(CameraSourceTypes.PHOTO);
      this.tabVideoHidden = !this._cameraModes.includes(CameraSourceTypes.VIDEO);
      this.messageHidden = true;
      this.timerHidden = true;
      this.currentIcon = currentIcon;
      this.audioToggleMicrophoneHidden = !visibleAudio;
      this.audioSelectHidden = !visibleAudio;
    } else if (state === 'prompt') {
      this.l10nMessage = 'camera-permissions-prompt';
      this.videoHidden = true;
      this.cameraHidden = true;
      this.tabCameraHidden = true;
      this.messageHidden = false;

      this._stopCapture();
    } else {
      this.l10nMessage = 'camera-permissions-denied';
      this.videoHidden = true;
      this.messageHidden = false;
      this.tabCameraHidden = !this._cameraModes.includes(CameraSourceTypes.PHOTO);
      this.tabVideoHidden = !this._cameraModes.includes(CameraSourceTypes.VIDEO);
      this.cameraActionsHidden = true;
      this.mutableClassButton = 'uc-shot-btn uc-camera-action';

      this._stopCapture();
    }
  }, 300);

  _makeStreamInactive = (): boolean => {
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

  _stopCapture = (): void => {
    if (this._capturing) {
      if (this.videoRef.value) {
        this.videoRef.value.volume = 0;
      }
      const tracks = this._currentVideoSource?.getTracks?.();
      tracks?.[0]?.stop();
      this._detachPreviewListeners(this.videoRef.value);
      this._setVideoSource(null);

      this._makeStreamInactive();
      this._stopTimer();

      this._capturing = false;
    }
  };

  _capture = async (): Promise<void> => {
    const constraints: MediaStreamConstraints = {
      video: { ...DEFAULT_VIDEO_CONFIG },
      audio: this.cfg.enableAudioRecording ? ({} as MediaTrackConstraints) : false,
    };

    if (this._selectedCameraId) {
      constraints.video = {
        deviceId: {
          exact: this._selectedCameraId,
        },
      } as MediaTrackConstraints;
    }

    if (this._selectedAudioId && this.cfg.enableAudioRecording) {
      constraints.audio = {
        deviceId: {
          exact: this._selectedAudioId,
        },
      } as MediaTrackConstraints;
    }

    // Mute the video to prevent feedback for Firefox
    if (this.videoRef.value) {
      this.videoRef.value.volume = 0;
    }

    try {
      this._setPermissionsState('prompt');
      this._stream = await navigator.mediaDevices.getUserMedia(constraints);

      this._stream.addEventListener('inactive', () => {
        this._setPermissionsState('denied');
      });

      this._setVideoSource(this._stream);
      this._capturing = true;
      this._setPermissionsState('granted');
    } catch (error) {
      this._setPermissionsState('denied');
      console.log('Failed to capture camera', error);
      this.telemetryManager.sendEventError(error, 'camera capturing. Failed to capture camera');
    }
  };

  _handlePermissionsChange = (): void => {
    this._capture();
  };

  _permissionAccess = async (): Promise<void> => {
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
      this._capture();
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

  _getPermission = (): void => {};

  _requestDeviceAccess = async (): Promise<void> => {
    try {
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: this.cfg.enableAudioRecording,
      });
      await this._getDevices();

      navigator.mediaDevices.addEventListener('devicechange', this._getDevices);
    } catch (error) {
      this.telemetryManager.sendEventError(error, 'camera devices. Failed to get user media');
      console.log('Failed to get user media', error);
    }
  };

  _getDevices = async (): Promise<void> => {
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

      this.cameraSelectOptions = this._cameraDevices;
      this.cameraSelectHidden = this._cameraDevices.length <= 1;
      this._selectedCameraId = this._cameraDevices[0]?.value ?? null;

      this.audioSelectOptions = this._audioDevices;
      this.audioSelectHidden = !this.cfg.enableAudioRecording || this._audioDevices.length <= 1;
      this._selectedAudioId = this._audioDevices[0]?.value ?? null;
    } catch (error) {
      this.telemetryManager.sendEventError(error, 'camera devices. Failed to get devices');
      console.log('Failed to get devices', error);
    }
  };

  _onActivate = async (): Promise<void> => {
    await this._permissionAccess();
    await this._requestDeviceAccess();
    await this._capture();

    this._handleCameraModes(this._cameraModes);
  };

  _onDeactivate = async (): Promise<void> => {
    if (this._unsubPermissions) {
      this._unsubPermissions();
    }

    /** Calling this method here because safari and firefox don't support the inactive event yet */
    const isChromium = Boolean((window as Window & { chrome?: unknown }).chrome);
    if (!isChromium) {
      this._setPermissionsState('denied');
    }

    this._stopCapture();
  };

  _handleCameraModes = (cameraModes: CameraMode[]): void => {
    this.tabVideoHidden = !cameraModes.includes(CameraSourceTypes.VIDEO);
    this.tabCameraHidden = !cameraModes.includes(CameraSourceTypes.PHOTO);

    const defaultTab = cameraModes[0];
    if (defaultTab && (!this._activeTab || !cameraModes.includes(this._activeTab))) {
      this._handleActiveTab(defaultTab);
    }
  };

  override initCallback(): void {
    super.initCallback();

    this.registerActivity(this.activityType, {
      onActivate: this._onActivate,
      onDeactivate: this._onDeactivate,
    });

    this.subConfigValue('cameraMirror', (val) => {
      this.videoTransformCss = val ? 'scaleX(-1)' : null;
    });

    this.subConfigValue('enableAudioRecording', (val) => {
      this.audioToggleMicrophoneHidden = !val;
      this.audioSelectDisabled = !val;
    });

    this.subConfigValue('cameraModes', (val) => {
      if (!this.isActivityActive) return;
      const cameraModes = deserializeCsv(val);
      this._handleCameraModes(
        cameraModes.filter(
          (mode): mode is CameraMode => mode === CameraSourceTypes.PHOTO || mode === CameraSourceTypes.VIDEO,
        ),
      );
    });
  }

  protected override firstUpdated(_changedProperties: Map<PropertyKey, unknown>): void {
    super.firstUpdated(_changedProperties);
    this._applyVideoSource();
  }

  protected override updated(_changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(_changedProperties);
    this._applyVideoSource();
  }

  _destroy(): void {
    this._teardownPermissionListeners();
    navigator.mediaDevices?.removeEventListener('devicechange', this._getDevices);
    this._detachPreviewListeners(this.videoRef.value);
    this._setVideoSource(null);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    this._destroy();
  }

  override render() {
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
    <div ?hidden=${!this.cameraSelectHidden}>
      <uc-icon name="camera"></uc-icon>
      <span>${this.l10n('caption-camera')}</span>
    </div>
    <uc-select
      class="uc-camera-select"
      .options=${this.cameraSelectOptions}
      ?hidden=${this.cameraSelectHidden}
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
      style=${styleMap({
        transform: this.videoTransformCss,
      })}
      ?hidden=${this.videoHidden}
      ${ref(this.videoRef)}
    ></video>
    <div class="uc-message-box" ?hidden=${this.messageHidden}>
      <span>${this.l10n(this.l10nMessage)}</span>
      <button
        type="button"
        @click=${this._handleRequestPermissions}
        ?hidden=${this.requestBtnHidden}
        >${this.l10n('camera-permissions-request')}</button>
    </div>
  </div>

  <div class="uc-controls">
    <div ${ref(this.switcherRef)} class="uc-switcher" ?hidden=${!this.timerHidden}>
      <button
        data-id="photo"
        type="button"
        class="uc-switch uc-mini-btn"
        @click=${this._handleClickTab}
        ?hidden=${this.tabCameraHidden}
        data-testid="tab-photo"
      >
        <uc-icon name="camera"></uc-icon>
      </button>
      <button
        data-id="video"
        type="button"
        class="uc-switch uc-mini-btn"
        @click=${this._handleClickTab}
        ?hidden=${this.tabVideoHidden}
        data-testid="tab-video"
      >
        <uc-icon name="video-camera"></uc-icon>
      </button>
    </div>

    <button
      class="uc-secondary-btn uc-recording-timer"
      @click=${this._handleToggleRecording}
      ?hidden=${this.timerHidden}
      data-testid="recording-timer"
    >
      <uc-icon name=${this.currentTimelineIcon}></uc-icon>
      <span ${ref(this.timerRef)}> 00:00 </span>
      <span ${ref(this.lineRef)} class="uc-line"></span>
    </button>

    <div
      class="uc-camera-actions uc-camera-action"
      ?hidden=${this.cameraActionsHidden}
    >
      <button type="button" class="uc-secondary-btn" @click=${this._handleRetake}>
        Retake
      </button>
      <button
        type="button"
        class="uc-primary-btn"
        @click=${this._handleAccept}
        data-testid="accept"
      >
        Accept
      </button>
    </div>

    <button
      type="button"
      class="uc-shot-btn uc-camera-action"
      data-testid="shot"
      @click=${this._handleStartCamera}
      class=${this.mutableClassButton}
      ?hidden=${this.cameraHidden}
    >
      <uc-icon name=${this.currentIcon}></uc-icon>
    </button>

    <div class="uc-select">
      <button
        type="button"
        class="uc-mini-btn uc-btn-microphone"
        @click=${this._handleToggleAudio}
        ?hidden=${this.audioToggleMicrophoneHidden}
        data-testid="toggle-microphone"
      >
        <uc-icon name=${this.toggleMicrophoneIcon}></uc-icon>
      </button>

      <uc-select
        class="uc-audio-select"
        .options=${this.audioSelectOptions}
        ?hidden=${this.audioSelectHidden}
        ?disabled=${this.audioSelectDisabled}
        @change=${this._handleAudioSelectChange}
        data-testid="audio-select"
      >
      </uc-select>
    </div>
  </div>
`;
  }
}
