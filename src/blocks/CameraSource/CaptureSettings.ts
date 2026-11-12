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

/** A camera setting the user can pick in the settings popup, besides the devices. */
export type CameraSetting = 'aspectRatio' | 'resolution' | 'audioQuality' | 'audioMode';

/** The element's readers of the four options; tracked, so a render that reads a value re-renders when it changes. */
export type CaptureSettingsConfig = {
  aspectRatio(): string;
  resolution(): string;
  audioQuality(): string;
  audioMode(): string;
};

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

  public constructor(private readonly _config: CaptureSettingsConfig) {}

  public get aspectRatioOptions(): string[] {
    return parseAspectRatioOptions(this._config.aspectRatio());
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
    return filterResolutionOptions(parseOptions(this._config.resolution(), RESOLUTIONS), this.maxShortSide);
  }

  /** A single value is a request rather than a picker option, so it applies even above what the camera reports. */
  public get resolution(): CameraResolution {
    return (
      this._pickedResolution ??
      this.resolutionOptions[0] ??
      parseOptions(this._config.resolution(), RESOLUTIONS)[0] ??
      'auto'
    );
  }

  public get audioQualityOptions(): CameraAudioQuality[] {
    return parseOptions(this._config.audioQuality(), AUDIO_QUALITIES);
  }

  public get audioQuality(): CameraAudioQuality {
    return this._pickedAudioQuality ?? this.audioQualityOptions[0] ?? 'auto';
  }

  public get audioModeOptions(): CameraAudioMode[] {
    return parseOptions(this._config.audioMode(), AUDIO_MODES);
  }

  public get audioMode(): CameraAudioMode {
    return this._pickedAudioMode ?? this.audioModeOptions[0] ?? 'voice';
  }

  public pick(setting: CameraSetting, value: string): void {
    switch (setting) {
      case 'aspectRatio':
        this._pickedAspectRatio = value;
        break;
      case 'resolution':
        this._pickedResolution = value as CameraResolution;
        break;
      case 'audioQuality':
        this._pickedAudioQuality = value as CameraAudioQuality;
        break;
      case 'audioMode':
        this._pickedAudioMode = value as CameraAudioMode;
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
