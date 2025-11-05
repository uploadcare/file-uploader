import { html } from '@symbiotejs/symbiote';
import { ActivityBlock } from '../../abstract/ActivityBlock';
import { UploaderBlock } from '../../abstract/UploaderBlock';
import { canUsePermissionsApi } from '../../utils/abilities';
import { deserializeCsv } from '../../utils/comma-separated';
import { debounce } from '../../utils/debounce';
import { stringToArray } from '../../utils/stringToArray';
import { UploadSource } from '../../utils/UploadSource';
import { InternalEventType } from '../UploadCtxProvider/EventEmitter';
import './camera-source.css';
import { CameraSourceEvents, CameraSourceTypes } from './constants';

type CameraDeviceOption = { text: string; value: string };
type AudioDeviceOption = { text: string; value: string };

type CameraSourceInitState = InstanceType<typeof UploaderBlock>['init$'] & {
  video: MediaStream | null;
  videoTransformCss: string | null;
  videoHidden: boolean;
  messageHidden: boolean;
  requestBtnHidden: boolean;
  cameraSelectOptions: CameraDeviceOption[] | null;
  cameraSelectHidden: boolean;
  l10nMessage: string;
  switcher: HTMLElement | null;
  panels: HTMLElement | null;
  timer: HTMLElement | null;
  timerHidden: boolean;
  cameraHidden: boolean;
  cameraActionsHidden: boolean;
  audioSelectOptions: AudioDeviceOption[] | null;
  audioSelectHidden: boolean;
  audioSelectDisabled: boolean;
  audioToggleMicrophoneHidden: boolean;
  tabCameraHidden: boolean;
  tabVideoHidden: boolean;
  currentIcon: string;
  currentTimelineIcon: string;
  toggleMicrophoneIcon: string;
  _startTime: number;
  _elapsedTime: number;
  _animationFrameId: number | null;
  mutableClassButton: string;
  onCameraSelectChange: (event: Event) => void;
  onAudioSelectChange: (event: Event) => void;
  onCancel: () => void;
  onShot: () => void;
  onRequestPermissions: () => void;
  onStartCamera: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleRecording: () => void;
  onToggleAudio: () => void;
  onRetake: () => void;
  onAccept: () => void;
  onClickTab: (event: MouseEvent) => void;
};

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

export class CameraSource extends UploaderBlock {
  override couldBeCtxOwner = true;
  override activityType = ActivityBlock.activities.CAMERA;

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

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      video: null,
      videoTransformCss: null,

      videoHidden: true,
      messageHidden: true,
      requestBtnHidden: canUsePermissionsApi(),
      cameraSelectOptions: null,
      cameraSelectHidden: true,
      l10nMessage: '',

      // This is refs
      switcher: null,
      panels: null,
      timer: null,

      timerHidden: true,
      cameraHidden: true,
      cameraActionsHidden: true,

      audioSelectOptions: null,
      audioSelectHidden: true,
      audioSelectDisabled: true,
      audioToggleMicrophoneHidden: true,

      tabCameraHidden: true,
      tabVideoHidden: true,

      currentIcon: 'camera-full',
      currentTimelineIcon: 'play',
      toggleMicrophoneIcon: 'microphone',

      _startTime: 0,
      _elapsedTime: 0,
      _animationFrameId: null,

      mutableClassButton: 'uc-shot-btn uc-camera-action',

      onCameraSelectChange: (event: Event) => {
        const target = event.target as HTMLSelectElement | null;
        if (!target) {
          return;
        }
        this._selectedCameraId = target.value;
        this._capture();
      },

      onAudioSelectChange: (event: Event) => {
        const target = event.target as HTMLSelectElement | null;
        if (!target) {
          return;
        }
        this._selectedAudioId = target.value;
        this._capture();
      },

      onCancel: () => {
        this.historyBack();
      },

      onShot: () => {
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
        this._shot();
      },

      onRequestPermissions: () => this._capture(),

      /** General method for photo and video capture */
      onStartCamera: () => {
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
        this._chooseActionWithCamera();
      },

      onStartRecording: () => this._startRecording(),

      onStopRecording: () => this._stopRecording(),

      onToggleRecording: () => this._toggleRecording(),

      onToggleAudio: () => this._toggleEnableAudio(),

      onRetake: () => {
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
      },

      onAccept: () => {
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
      },

      onClickTab: (event: MouseEvent) => {
        const target = event.currentTarget as HTMLElement | null;
        const id = target?.getAttribute('data-id');
        if (id) {
          this._handleActiveTab(id as CameraMode);
        }
      },
    } as CameraSourceInitState;
  }

  _chooseActionWithCamera = () => {
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

  _updateTimer = (): void => {
    const currentTime = Math.floor((performance.now() - this.$._startTime + this.$._elapsedTime) / 1000);

    if (typeof this.cfg.maxVideoRecordingDuration === 'number' && this.cfg.maxVideoRecordingDuration > 0) {
      const remainingTime = this.cfg.maxVideoRecordingDuration - currentTime;

      if (remainingTime <= 0) {
        const timer = this.ref.timer as HTMLElement | undefined;
        if (timer) {
          timer.textContent = formatTime(remainingTime);
        }
        this._stopRecording();
        return;
      }

      const timer = this.ref.timer as HTMLElement | undefined;
      if (timer) {
        timer.textContent = formatTime(remainingTime);
      }
    } else {
      const timer = this.ref.timer as HTMLElement | undefined;
      if (timer) {
        timer.textContent = formatTime(currentTime);
      }
    }

    this._animationFrameId = requestAnimationFrame(this._updateTimer);
  };

  _startTimer = (): void => {
    this.$._startTime = performance.now();
    this.$._elapsedTime = 0;

    this._updateTimer();
  };

  _stopTimer = (): void => {
    if (this._animationFrameId) cancelAnimationFrame(this._animationFrameId);
  };

  _startTimeline = (): void => {
    const video = this.ref.video as HTMLVideoElement | undefined;
    if (!video) {
      return;
    }
    const currentTime = video.currentTime;
    const duration = video.duration || 1;

    const line = this.ref.line as HTMLElement | undefined;
    if (line) {
      line.style.transform = `scaleX(${currentTime / duration})`;
    }
    const timer = this.ref.timer as HTMLElement | undefined;
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

    if (!this.ref.video.paused && !this.ref.video.ended && this.ref.video.readyState > 2) {
      this.ref.video.pause();
    } else if (this.ref.video.paused) {
      this.ref.video.play();
    }
  };

  _toggleEnableAudio = (): void => {
    this._stream?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;

      this.$.toggleMicrophoneIcon = !track.enabled ? 'microphone-mute' : 'microphone';
      this.$.audioSelectDisabled = !track.enabled;
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

      const videoElement = this.ref.video as HTMLVideoElement | undefined;
      if (!videoElement) {
        return;
      }

      videoElement.muted = false;
      videoElement.volume = 1;
      this.$.video = null;
      videoElement.src = videoURL;

      videoElement.addEventListener('play', () => {
        this._startTimeline();
        this.set$({
          currentTimelineIcon: 'pause',
        });
      });

      videoElement.addEventListener('pause', () => {
        this.set$({
          currentTimelineIcon: 'play',
        });
        this._stopTimeline();
      });
    } catch (error) {
      console.error('Failed to preview video', error);
      this.telemetryManager.sendEventError(error, 'camera previewing. Failed to preview video');
    }
  };

  _retake = (): void => {
    this._setCameraState(CameraSourceEvents.RETAKE);

    /** Reset video */
    if (this._activeTab === CameraSourceTypes.VIDEO) {
      this.$.video = this._stream;
      const videoElement = this.ref.video as HTMLVideoElement | undefined;
      if (videoElement) {
        videoElement.muted = true;
      }
    }

    void this.ref.video?.play?.();
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
      this.set$({
        tabVideoHidden: true,
        cameraHidden: true,
        tabCameraHidden: true,
        cameraActionsHidden: false,
        cameraSelectHidden: true,
      });
    }

    if (status === CameraSourceEvents.RETAKE || status === CameraSourceEvents.ACCEPT) {
      this.set$({
        tabVideoHidden: !this._cameraModes.includes(CameraSourceTypes.VIDEO),
        tabCameraHidden: !this._cameraModes.includes(CameraSourceTypes.PHOTO),
        cameraHidden: false,
        cameraActionsHidden: true,
        cameraSelectHidden: this._cameraDevices.length <= 1,
      });
    }
  };

  _handleVideo = (status: CameraStatus): void => {
    if (status === CameraSourceEvents.PLAY) {
      this.set$({
        timerHidden: false,
        tabCameraHidden: true,

        cameraSelectHidden: true,
        audioSelectHidden: true,

        currentTimelineIcon: 'pause',
        currentIcon: 'square',
        mutableClassButton: 'uc-shot-btn uc-camera-action uc-stop-record',
      });
    }

    if (status === CameraSourceEvents.STOP) {
      this.set$({
        timerHidden: false,
        cameraHidden: true,
        audioToggleMicrophoneHidden: true,
        cameraActionsHidden: false,
      });
    }

    if (status === CameraSourceEvents.RETAKE || status === CameraSourceEvents.ACCEPT) {
      this.set$({
        timerHidden: true,
        tabVideoHidden: !this._cameraModes.includes(CameraSourceTypes.VIDEO),
        tabCameraHidden: !this._cameraModes.includes(CameraSourceTypes.PHOTO),
        cameraHidden: false,
        cameraActionsHidden: true,
        audioToggleMicrophoneHidden: !this.cfg.enableAudioRecording,
        currentIcon: 'video-camera-full',
        mutableClassButton: 'uc-shot-btn uc-camera-action',

        audioSelectHidden: !this.cfg.enableAudioRecording || this._audioDevices.length <= 1,
        cameraSelectHidden: this._cameraDevices.length <= 1,
      });
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

    this._canvas.height = this.ref.video.videoHeight;
    this._canvas.width = this.ref.video.videoWidth;

    if (this.cfg.cameraMirror) {
      this._ctx.translate(this._canvas.width, 0);
      this._ctx.scale(-1, 1);
    }

    this._ctx.drawImage(this.ref.video, 0, 0);
    this.ref.video.pause();
  }

  private _handleActiveTab = (tabId: CameraMode): void => {
    const switcher = this.ref.switcher as HTMLElement | undefined;
    switcher?.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('uc-active', btn.getAttribute('data-id') === tabId);
    });

    if (tabId === CameraSourceTypes.PHOTO) {
      this.set$({
        currentIcon: 'camera-full',
        audioSelectHidden: true,
        audioToggleMicrophoneHidden: true,
      });
    }

    if (tabId === CameraSourceTypes.VIDEO) {
      this.set$({
        currentTimelineIcon: 'play',
        currentIcon: 'video-camera-full',

        audioSelectHidden: !this.cfg.enableAudioRecording || this._audioDevices.length <= 1,
        audioToggleMicrophoneHidden: !this.cfg.enableAudioRecording,
      });
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
      '*currentActivity': ActivityBlock.activities.UPLOAD_LIST,
    });
    this.modalManager?.open(ActivityBlock.activities.UPLOAD_LIST);
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
      this.set$({
        videoHidden: false,
        cameraHidden: false,
        tabCameraHidden: !this._cameraModes.includes(CameraSourceTypes.PHOTO),
        tabVideoHidden: !this._cameraModes.includes(CameraSourceTypes.VIDEO),
        messageHidden: true,
        timerHidden: true,

        currentIcon,
        audioToggleMicrophoneHidden: !visibleAudio,
        audioSelectHidden: !visibleAudio,
      });
    } else if (state === 'prompt') {
      this.$.l10nMessage = 'camera-permissions-prompt';

      this.set$({
        videoHidden: true,
        cameraHidden: true,
        tabCameraHidden: true,
        messageHidden: false,
      });

      this._stopCapture();
    } else {
      this.$.l10nMessage = 'camera-permissions-denied';

      this.set$({
        videoHidden: true,
        messageHidden: false,

        tabCameraHidden: !this._cameraModes.includes(CameraSourceTypes.PHOTO),
        tabVideoHidden: !this._cameraModes.includes(CameraSourceTypes.VIDEO),

        cameraActionsHidden: true,

        mutableClassButton: 'uc-shot-btn uc-camera-action',
      });

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
      this.ref.video.volume = 0;
      const tracks = this.$.video?.getTracks?.();
      tracks?.[0]?.stop();
      this.$.video = null;

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
    if (this.ref.video) {
      this.ref.video.volume = 0;
    }

    try {
      this._setPermissionsState('prompt');
      this._stream = await navigator.mediaDevices.getUserMedia(constraints);

      this._stream.addEventListener('inactive', () => {
        this._setPermissionsState('denied');
      });

      this.$.video = this._stream;
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
      for (const permission of DEFAULT_PERMISSIONS) {
        const response = await navigator.permissions.query({
          name: permission as PermissionName,
        });
        this._permissionResponses[permission] = response;

        response.addEventListener('change', this._handlePermissionsChange);
      }
    } catch (error) {
      console.log('Failed to use permissions API. Fallback to manual request mode.', error);
      this.telemetryManager.sendEventError(error, 'camera permissions. Failed to use permissions API');
      this._capture();
    }
  };

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

      if (this._cameraDevices.length > 1) {
        this.set$({
          cameraSelectOptions: this._cameraDevices,
          cameraSelectHidden: false,
        });
      }
      this._selectedCameraId = this._cameraDevices[0]?.value ?? null;

      if (this._audioDevices.length > 1) {
        this.set$({
          audioSelectOptions: this._audioDevices,
          audioSelectHidden: false,
        });
      }
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
    this.$.tabVideoHidden = !cameraModes.includes(CameraSourceTypes.VIDEO);
    this.$.tabCameraHidden = !cameraModes.includes(CameraSourceTypes.PHOTO);

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
      this.$.videoTransformCss = val ? 'scaleX(-1)' : null;
    });

    this.subConfigValue('enableAudioRecording', (val) => {
      this.$.audioToggleMicrophoneHidden = !val;
      this.$.audioSelectDisabled = !val;
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

  _destroy(): void {
    for (const permission of DEFAULT_PERMISSIONS) {
      this._permissionResponses[permission]?.removeEventListener('change', this._handlePermissionsChange);
    }

    navigator.mediaDevices?.removeEventListener('devicechange', this._getDevices);
  }

  override async destroyCallback(): Promise<void> {
    super.destroyCallback();

    this._destroy();
  }
}

CameraSource.template = html`
  <uc-activity-header>
    <button
      type="button"
      class="uc-mini-btn"
      bind="onclick: *historyBack"
      l10n="@title:back"
    >
      <uc-icon name="back"></uc-icon>
    </button>
    <div bind="@hidden: !cameraSelectHidden">
      <uc-icon name="camera"></uc-icon>
      <span l10n="caption-camera"></span>
    </div>
    <uc-select
      class="uc-camera-select"
      bind="$.options: cameraSelectOptions; @hidden: cameraSelectHidden; onchange: onCameraSelectChange"
    >
    </uc-select>
    <button
      type="button"
      class="uc-mini-btn uc-close-btn"
      bind="onclick: *closeModal"
      l10n="@title:a11y-activity-header-button-close;@aria-label:a11y-activity-header-button-close"
    >
      <uc-icon name="close"></uc-icon>
    </button>
  </uc-activity-header>
  <div class="uc-content">
    <video
      muted
      autoplay
      playsinline
      bind="srcObject: video; style.transform: videoTransformCss; @hidden: videoHidden"
      ref="video"
    ></video>
    <div class="uc-message-box" bind="@hidden: messageHidden">
      <span l10n="l10nMessage"></span>
      <button
        type="button"
        bind="onclick: onRequestPermissions; @hidden: requestBtnHidden"
        l10n="camera-permissions-request"
      ></button>
    </div>
  </div>

  <div class="uc-controls">
    <div ref="switcher" class="uc-switcher" bind="@hidden:!timerHidden">
      <button
        data-id="photo"
        type="button"
        class="uc-switch uc-mini-btn"
        bind="onclick: onClickTab;  @hidden: tabCameraHidden"
        data-testid="tab-photo"
      >
        <uc-icon name="camera"></uc-icon>
      </button>
      <button
        data-id="video"
        type="button"
        class="uc-switch uc-mini-btn"
        bind="onclick: onClickTab; @hidden: tabVideoHidden"
        data-testid="tab-video"
      >
        <uc-icon name="video-camera"></uc-icon>
      </button>
    </div>

    <button
      class="uc-secondary-btn uc-recording-timer"
      bind="@hidden:timerHidden; onclick: onToggleRecording"
      data-testid="recording-timer"
    >
      <uc-icon bind="@name: currentTimelineIcon"></uc-icon>
      <span ref="timer"> 00:00 </span>
      <span ref="line" class="uc-line"></span>
    </button>

    <div
      class="uc-camera-actions uc-camera-action"
      bind="@hidden: cameraActionsHidden"
    >
      <button type="button" class="uc-secondary-btn" bind="onclick: onRetake">
        Retake
      </button>
      <button
        type="button"
        class="uc-primary-btn"
        bind="onclick: onAccept"
        data-testid="accept"
      >
        Accept
      </button>
    </div>

    <button
      type="button"
      class="uc-shot-btn uc-camera-action"
      data-testid="shot"
      bind="onclick: onStartCamera; @class: mutableClassButton; @hidden: cameraHidden;"
    >
      <uc-icon bind="@name: currentIcon"></uc-icon>
    </button>

    <div class="uc-select">
      <button
        class="uc-mini-btn uc-btn-microphone"
        bind="onclick: onToggleAudio; @hidden: audioToggleMicrophoneHidden;"
        data-testid="toggle-microphone"
      >
        <uc-icon bind="@name:toggleMicrophoneIcon"></uc-icon>
      </button>

      <uc-select
        class="uc-audio-select"
        bind="$.options: audioSelectOptions; onchange: onAudioSelectChange; @hidden: audioSelectHidden; @disabled: audioSelectDisabled"
        data-testid="audio-select"
      >
      </uc-select>
    </div>
  </div>
`;
