import { html, type PropertyValues } from 'lit';
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
  public override couldBeCtxOwner = true;
  public override activityType = LitActivityBlock.activities.CAMERA;

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
    this._currentTimelineIcon = 'pause';
  };

  private readonly _handlePreviewPause = (): void => {
    this._currentTimelineIcon = 'play';
    this._stopTimeline();
  };

  private _timerRef = createRef<HTMLElement>();
  private _lineRef = createRef<HTMLElement>();
  private _videoRef = createRef<HTMLVideoElement>();
  private _switcherRef = createRef<HTMLElement>();
  private _startTime = 0;
  private _elapsedTime = 0;

  @state()
  private _videoTransformCss: string | null = null;

  @state()
  private _videoHidden = true;

  @state()
  private _messageHidden = true;

  @state()
  private _requestBtnHidden = canUsePermissionsApi();

  @state()
  private _cameraSelectOptions: CameraDeviceOption[] = [];

  @state()
  private _cameraSelectHidden = true;

  @state()
  private _l10nMessage = '';

  @state()
  private _timerHidden = true;

  @state()
  private _cameraHidden = true;

  @state()
  private _cameraActionsHidden = true;

  @state()
  private _audioSelectOptions: AudioDeviceOption[] = [];

  @state()
  private _audioSelectHidden = true;

  @state()
  private _audioSelectDisabled = true;

  @state()
  private _audioToggleMicrophoneHidden = true;

  @state()
  private _tabCameraHidden = true;

  @state()
  private _tabVideoHidden = true;

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

  private _handlePhoto = (status: CameraStatus): void => {
    if (status === CameraSourceEvents.SHOT) {
      this._tabVideoHidden = true;
      this._cameraHidden = true;
      this._tabCameraHidden = true;
      this._cameraActionsHidden = false;
      this._cameraSelectHidden = true;
    }

    if (status === CameraSourceEvents.RETAKE || status === CameraSourceEvents.ACCEPT) {
      this._tabVideoHidden = !this._cameraModes.includes(CameraSourceTypes.VIDEO);
      this._tabCameraHidden = !this._cameraModes.includes(CameraSourceTypes.PHOTO);
      this._cameraHidden = false;
      this._cameraActionsHidden = true;
      this._cameraSelectHidden = this._cameraDevices.length <= 1;
    }
  };

  private _handleVideo = (status: CameraStatus): void => {
    if (status === CameraSourceEvents.PLAY) {
      this._timerHidden = false;
      this._tabCameraHidden = true;
      this._cameraSelectHidden = true;
      this._audioSelectHidden = true;
      this._currentTimelineIcon = 'pause';
      this._currentIcon = 'square';
      this._mutableClassButton = 'uc-shot-btn uc-camera-action uc-stop-record';
    }

    if (status === CameraSourceEvents.STOP) {
      this._timerHidden = false;
      this._cameraHidden = true;
      this._audioToggleMicrophoneHidden = true;
      this._cameraActionsHidden = false;
    }

    if (status === CameraSourceEvents.RETAKE || status === CameraSourceEvents.ACCEPT) {
      this._timerHidden = true;
      this._tabVideoHidden = !this._cameraModes.includes(CameraSourceTypes.VIDEO);
      this._tabCameraHidden = !this._cameraModes.includes(CameraSourceTypes.PHOTO);
      this._cameraHidden = false;
      this._cameraActionsHidden = true;
      this._audioToggleMicrophoneHidden = !this.cfg.enableAudioRecording;
      this._currentIcon = 'video-camera-full';
      this._mutableClassButton = 'uc-shot-btn uc-camera-action';
      this._audioSelectHidden = !this.cfg.enableAudioRecording || this._audioDevices.length <= 1;
      this._cameraSelectHidden = this._cameraDevices.length <= 1;
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
    const switcher = this._switcherRef.value as HTMLElement | undefined;
    switcher?.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('uc-active', btn.getAttribute('data-id') === tabId);
    });

    if (tabId === CameraSourceTypes.PHOTO) {
      this._currentIcon = 'camera-full';
      this._audioSelectHidden = true;
      this._audioToggleMicrophoneHidden = true;
    }

    if (tabId === CameraSourceTypes.VIDEO) {
      this._currentTimelineIcon = 'play';
      this._currentIcon = 'video-camera-full';
      this._audioSelectHidden = !this.cfg.enableAudioRecording || this._audioDevices.length <= 1;
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
      this._videoHidden = false;
      this._cameraHidden = false;
      this._tabCameraHidden = !this._cameraModes.includes(CameraSourceTypes.PHOTO);
      this._tabVideoHidden = !this._cameraModes.includes(CameraSourceTypes.VIDEO);
      this._messageHidden = true;
      this._timerHidden = true;
      this._currentIcon = currentIcon;
      this._audioToggleMicrophoneHidden = !visibleAudio;
      this._audioSelectHidden = !visibleAudio;
    } else if (state === 'prompt') {
      this._l10nMessage = 'camera-permissions-prompt';
      this._videoHidden = true;
      this._cameraHidden = true;
      this._tabCameraHidden = true;
      this._messageHidden = false;

      this._stopCapture();
    } else {
      this._l10nMessage = 'camera-permissions-denied';
      this._videoHidden = true;
      this._messageHidden = false;
      this._tabCameraHidden = !this._cameraModes.includes(CameraSourceTypes.PHOTO);
      this._tabVideoHidden = !this._cameraModes.includes(CameraSourceTypes.VIDEO);
      this._cameraActionsHidden = true;
      this._mutableClassButton = 'uc-shot-btn uc-camera-action';

      this._stopCapture();
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

  private _stopCapture = (): void => {
    if (this._capturing) {
      if (this._videoRef.value) {
        this._videoRef.value.volume = 0;
      }
      const tracks = this._currentVideoSource?.getTracks?.();
      tracks?.[0]?.stop();
      this._detachPreviewListeners(this._videoRef.value);
      this._setVideoSource(null);

      this._makeStreamInactive();
      this._stopTimer();

      this._capturing = false;
    }
  };

  private _capture = async (): Promise<void> => {
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
    if (this._videoRef.value) {
      this._videoRef.value.volume = 0;
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

  private _requestDeviceAccess = async (): Promise<void> => {
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
      this._cameraSelectHidden = this._cameraDevices.length <= 1;
      this._selectedCameraId = this._cameraDevices[0]?.value ?? null;

      this._audioSelectOptions = this._audioDevices;
      this._audioSelectHidden = !this.cfg.enableAudioRecording || this._audioDevices.length <= 1;
      this._selectedAudioId = this._audioDevices[0]?.value ?? null;
    } catch (error) {
      this.telemetryManager.sendEventError(error, 'camera devices. Failed to get devices');
      console.log('Failed to get devices', error);
    }
  };

  private _onActivate = async (): Promise<void> => {
    await this._permissionAccess();
    await this._requestDeviceAccess();
    await this._capture();

    this._handleCameraModes(this._cameraModes);
  };

  private _onDeactivate = async (): Promise<void> => {
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

  private _handleCameraModes = (cameraModes: CameraMode[]): void => {
    this._tabVideoHidden = !cameraModes.includes(CameraSourceTypes.VIDEO);
    this._tabCameraHidden = !cameraModes.includes(CameraSourceTypes.PHOTO);

    const defaultTab = cameraModes[0];
    if (defaultTab && (!this._activeTab || !cameraModes.includes(this._activeTab))) {
      this._handleActiveTab(defaultTab);
    }
  };

  public override initCallback(): void {
    super.initCallback();

    this.registerActivity(this.activityType, {
      onActivate: this._onActivate,
      onDeactivate: this._onDeactivate,
    });

    this.subConfigValue('cameraMirror', (val) => {
      this._videoTransformCss = val ? 'scaleX(-1)' : null;
    });

    this.subConfigValue('enableAudioRecording', (val) => {
      this._audioToggleMicrophoneHidden = !val;
      this._audioSelectDisabled = !val;
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
    <div ?hidden=${!this._cameraSelectHidden}>
      <uc-icon name="camera"></uc-icon>
      <span>${this.l10n('caption-camera')}</span>
    </div>
    <uc-select
      class="uc-camera-select"
      .options=${this._cameraSelectOptions}
      ?hidden=${this._cameraSelectHidden}
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
        transform: this._videoTransformCss,
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
        >${this.l10n('camera-permissions-request')}</button>
    </div>
  </div>

  <div class="uc-controls">
    <div ${ref(this._switcherRef)} class="uc-switcher" ?hidden=${!this._timerHidden}>
      <button
        data-id="photo"
        type="button"
        class="uc-switch uc-mini-btn"
        @click=${this._handleClickTab}
        ?hidden=${this._tabCameraHidden}
        data-testid="tab-photo"
      >
        <uc-icon name="camera"></uc-icon>
      </button>
      <button
        data-id="video"
        type="button"
        class="uc-switch uc-mini-btn"
        @click=${this._handleClickTab}
        ?hidden=${this._tabVideoHidden}
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
      data-testid="shot"
      @click=${this._handleStartCamera}
      class=${this._mutableClassButton}
      ?hidden=${this._cameraHidden}
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

      <uc-select
        class="uc-audio-select"
        .options=${this._audioSelectOptions}
        ?hidden=${this._audioSelectHidden}
        ?disabled=${this._audioSelectDisabled}
        @change=${this._handleAudioSelectChange}
        data-testid="audio-select"
      >
      </uc-select>
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
