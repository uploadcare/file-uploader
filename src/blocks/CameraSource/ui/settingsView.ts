import { NATIVE_ASPECT_RATIO, toRatio } from '../../../abstract/camera/cameraSettings';
import type { CameraMode } from '../../../abstract/cameraModes';
import type { L10nKey } from '../../../abstract/l10n';
import type { CameraPermission } from '../CameraAccess';
import type { CameraDevices } from '../CameraDevices';
import type { CameraPhase } from '../CameraSession';
import type { CameraSetting, CaptureSettings } from '../CaptureSettings';
import type { CameraView } from './cameraView';

/** An option as written (`text`) or by l10n key (`textKey`); a ratio option has the shape its icon draws. */
export type SettingOptionData = { value: string; text?: string; textKey?: L10nKey; shape?: 'native' | number };

/** One section of the settings popup: a device picker or a capture setting, with its options and the value in effect. */
export type SettingSectionData = {
  key: 'camera' | 'microphone' | CameraSetting;
  labelKey: L10nKey;
  hidden: boolean;
  disabled?: boolean;
  value: string;
  options: SettingOptionData[];
};

export type SettingsViewInput = {
  view: CameraView;
  permission: CameraPermission;
  phase: CameraPhase;
  tab: CameraMode | null;
  audioEnabled: boolean;
  devices: Pick<CameraDevices, 'cameras' | 'microphones' | 'selectedCameraId' | 'selectedMicrophoneId'>;
  settings: Pick<
    CaptureSettings,
    | 'aspectRatioOptions'
    | 'aspectRatioChoice'
    | 'resolutionOptions'
    | 'resolution'
    | 'audioQualityOptions'
    | 'audioQuality'
    | 'audioModeOptions'
    | 'audioMode'
  >;
};

/**
 * The settings popup's sections, and whether its button hides. Audio settings only matter where sound is recorded:
 * video, with audio on.
 */
export function deriveSettingsView(input: SettingsViewInput): { sections: SettingSectionData[]; hidden: boolean } {
  const { view, permission, phase, tab, audioEnabled, devices, settings } = input;
  const audioContext = tab === 'video' && audioEnabled;
  const sections: SettingSectionData[] = [
    {
      key: 'camera',
      labelKey: 'caption-camera',
      hidden: view.cameraSelectHidden,
      options: devices.cameras,
      value: devices.selectedCameraId ?? '',
    },
    {
      key: 'aspectRatio',
      labelKey: 'camera-aspect-ratio',
      hidden: settings.aspectRatioOptions.length < 2,
      options: settings.aspectRatioOptions.map((value) =>
        value === NATIVE_ASPECT_RATIO
          ? { value, textKey: 'camera-aspect-ratio-native', shape: 'native' }
          : { value, text: value, shape: toRatio(value) ?? 'native' },
      ),
      value: settings.aspectRatioChoice,
    },
    {
      key: 'resolution',
      labelKey: 'camera-resolution',
      hidden: settings.resolutionOptions.length < 2,
      options: settings.resolutionOptions.map((value) =>
        value === 'auto' ? { value, textKey: 'camera-setting-auto' } : { value, text: value.toUpperCase() },
      ),
      value: settings.resolution,
    },
    {
      // Unlike the other pickers this one needs no config: it offers the microphones there are.
      key: 'microphone',
      labelKey: 'camera-microphone',
      hidden: view.audioSelectHidden,
      options: devices.microphones,
      value: devices.selectedMicrophoneId ?? '',
      disabled: view.audioSelectDisabled,
    },
    {
      key: 'audioQuality',
      labelKey: 'camera-audio-quality',
      hidden: settings.audioQualityOptions.length < 2 || !audioContext,
      options: settings.audioQualityOptions.map((value) => ({
        value,
        textKey: value === 'auto' ? 'camera-setting-auto' : `camera-audio-quality-${value}`,
      })),
      value: settings.audioQuality,
    },
    {
      key: 'audioMode',
      labelKey: 'camera-audio-mode',
      hidden: settings.audioModeOptions.length < 2 || !audioContext,
      options: settings.audioModeOptions.map((value) => ({ value, textKey: `camera-audio-mode-${value}` })),
      value: settings.audioMode,
    },
  ];
  const hidden = permission !== 'granted' || phase !== 'live' || sections.every((section) => section.hidden);
  return { sections, hidden };
}
