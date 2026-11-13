import {
  AUDIO_MODES,
  AUDIO_QUALITIES,
  filterResolutionOptions,
  NATIVE_ASPECT_RATIO,
  parseAspectRatioOptions,
  parseOptions,
  RESOLUTIONS,
  toRatio,
} from '../../abstract/camera/cameraSettings';
import { signalState } from '../../abstract/di/signalState';
import type { CameraAudioMode, CameraAudioQuality, CameraResolution } from '../../types/exported';
import type { CameraConfig } from './cameraHost';

/** A camera setting the user can pick in the settings popup, besides the devices. */
export type CameraSetting = 'aspectRatio' | 'resolution' | 'audioQuality' | 'audioMode';

const offered = <T extends string>(options: readonly T[], value: string): T | undefined =>
  options.find((option) => option === value);

/**
 * The capture settings: the options offered, and the value in effect for each, which is the user's pick, else the
 * first listed value.
 */
export class CaptureSettings {
  /** The largest short side the open camera reports, to leave out resolutions it can't do. */
  @signalState() public maxShortSide: number | null = null;

  /**
   * The user's picks in the settings, as option values. `null` until the user picks, in which case the first listed
   * value applies; a config change clears them again. They never write back to the config.
   */
  @signalState() private _pickedAspectRatio: string | null = null;
  @signalState() private _pickedResolution: CameraResolution | null = null;
  @signalState() private _pickedAudioQuality: CameraAudioQuality | null = null;
  @signalState() private _pickedAudioMode: CameraAudioMode | null = null;

  /** The four options are tracked reads, so a render that reads a value here re-renders when its option changes. */
  public constructor(private readonly _config: Pick<CameraConfig, 'getTracked'>) {}

  /** Starts from the picks of the session before, which a DOM move must not lose. */
  public keep(previous: CaptureSettings): void {
    this.maxShortSide = previous.maxShortSide;
    this._pickedAspectRatio = previous._pickedAspectRatio;
    this._pickedResolution = previous._pickedResolution;
    this._pickedAudioQuality = previous._pickedAudioQuality;
    this._pickedAudioMode = previous._pickedAudioMode;
  }

  public get aspectRatioOptions(): string[] {
    return parseAspectRatioOptions(this._config.getTracked('cameraAspectRatio'));
  }

  /** The ratio option in effect, `native` for the camera's own shape. */
  public get aspectRatioChoice(): string {
    return this._pickedAspectRatio ?? this.aspectRatioOptions[0] ?? NATIVE_ASPECT_RATIO;
  }

  /** Width / height in effect, or `null` for the camera's native shape. */
  public get aspectRatio(): number | null {
    return toRatio(this.aspectRatioChoice) ?? null;
  }

  /** The listed resolutions the camera can do. */
  public get resolutionOptions(): CameraResolution[] {
    return filterResolutionOptions(this._listedResolutions(), this.maxShortSide);
  }

  /** A single value is a request rather than a picker option, so it applies even above what the camera reports. */
  public get resolution(): CameraResolution {
    return this._pickedResolution ?? this.resolutionOptions[0] ?? this._listedResolutions()[0] ?? 'auto';
  }

  private _listedResolutions(): CameraResolution[] {
    return parseOptions(this._config.getTracked('cameraResolution'), RESOLUTIONS);
  }

  public get audioQualityOptions(): CameraAudioQuality[] {
    return parseOptions(this._config.getTracked('cameraAudioQuality'), AUDIO_QUALITIES);
  }

  public get audioQuality(): CameraAudioQuality {
    return this._pickedAudioQuality ?? this.audioQualityOptions[0] ?? 'auto';
  }

  public get audioModeOptions(): CameraAudioMode[] {
    return parseOptions(this._config.getTracked('cameraAudioMode'), AUDIO_MODES);
  }

  public get audioMode(): CameraAudioMode {
    return this._pickedAudioMode ?? this.audioModeOptions[0] ?? 'voice';
  }

  /** Picks `value` for `setting` when it is one of the options offered: the value comes from the page, as a string. */
  public pick(setting: CameraSetting, value: string): void {
    switch (setting) {
      case 'aspectRatio':
        this._pickedAspectRatio = offered(this.aspectRatioOptions, value) ?? this._pickedAspectRatio;
        break;
      case 'resolution':
        this._pickedResolution = offered(this.resolutionOptions, value) ?? this._pickedResolution;
        break;
      case 'audioQuality':
        this._pickedAudioQuality = offered(this.audioQualityOptions, value) ?? this._pickedAudioQuality;
        break;
      case 'audioMode':
        this._pickedAudioMode = offered(this.audioModeOptions, value) ?? this._pickedAudioMode;
        break;
    }
  }

  /** The option behind `setting` changed in the config: the user's pick gives way to its first listed value. */
  public reset(setting: CameraSetting): void {
    switch (setting) {
      case 'aspectRatio':
        this._pickedAspectRatio = null;
        break;
      case 'resolution':
        this._pickedResolution = null;
        break;
      case 'audioQuality':
        this._pickedAudioQuality = null;
        break;
      case 'audioMode':
        this._pickedAudioMode = null;
        break;
    }
  }

  /** Stores the camera's reach and drops a resolution pick it no longer offers. */
  public cameraOpened(maxShortSide: number | null): void {
    this.maxShortSide = maxShortSide;
    if (this._pickedResolution !== null && !this.resolutionOptions.includes(this._pickedResolution)) {
      this._pickedResolution = null;
    }
  }

  /** The capture telemetry fields: aspectRatio ('' for native), resolution, audioQuality, audioMode. */
  public telemetry(): { aspectRatio: string; resolution: string; audioQuality: string; audioMode: string } {
    return {
      aspectRatio: this.aspectRatioChoice === NATIVE_ASPECT_RATIO ? '' : this.aspectRatioChoice,
      resolution: this.resolution,
      audioQuality: this.audioQuality,
      audioMode: this.audioMode,
    };
  }
}
