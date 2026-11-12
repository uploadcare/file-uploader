import { describe, expect, it } from 'vitest';
import { deriveCameraView } from './cameraView';
import { deriveSettingsView, type SettingsViewInput } from './settingsView';

const input = (overrides: Partial<SettingsViewInput> = {}): SettingsViewInput => ({
  view: deriveCameraView({
    permission: 'granted',
    phase: 'live',
    tab: 'video',
    cameraModes: ['photo', 'video'],
    audioEnabled: true,
    cameraCount: 2,
    microphoneCount: 2,
    muted: false,
    microphoneDenied: false,
  }),
  permission: 'granted',
  phase: 'live',
  tab: 'video',
  audioEnabled: true,
  devices: {
    cameras: [
      { value: 'c1', text: 'Front' },
      { value: 'c2', text: 'Back' },
    ],
    microphones: [
      { value: 'm1', text: 'Mic 1' },
      { value: 'm2', text: 'Mic 2' },
    ],
    selectedCameraId: 'c2',
    selectedMicrophoneId: null,
  },
  settings: {
    aspectRatioOptions: ['native', '16:9'],
    aspectRatioChoice: 'native',
    resolutionOptions: ['auto', '720p'],
    resolution: '720p',
    audioQualityOptions: ['auto', 'high'],
    audioQuality: 'auto',
    audioModeOptions: ['voice', 'music'],
    audioMode: 'music',
  },
  ...overrides,
});

const section = (view: ReturnType<typeof deriveSettingsView>, key: string) =>
  view.sections.find((item) => item.key === key);

describe('deriveSettingsView', () => {
  it('lists the sections in order, with their labels, values and option texts', () => {
    const { sections, hidden } = deriveSettingsView(input());
    expect(hidden).toBe(false);
    expect(sections).toEqual([
      {
        key: 'camera',
        labelKey: 'caption-camera',
        hidden: false,
        options: [
          { value: 'c1', text: 'Front' },
          { value: 'c2', text: 'Back' },
        ],
        value: 'c2',
      },
      {
        key: 'aspectRatio',
        labelKey: 'camera-aspect-ratio',
        hidden: false,
        options: [
          { value: 'native', textKey: 'camera-aspect-ratio-native', shape: 'native' },
          { value: '16:9', text: '16:9', shape: 16 / 9 },
        ],
        value: 'native',
      },
      {
        key: 'resolution',
        labelKey: 'camera-resolution',
        hidden: false,
        options: [
          { value: 'auto', textKey: 'camera-setting-auto' },
          { value: '720p', text: '720P' },
        ],
        value: '720p',
      },
      {
        key: 'microphone',
        labelKey: 'camera-microphone',
        hidden: false,
        disabled: false,
        options: [
          { value: 'm1', text: 'Mic 1' },
          { value: 'm2', text: 'Mic 2' },
        ],
        value: '',
      },
      {
        key: 'audioQuality',
        labelKey: 'camera-audio-quality',
        hidden: false,
        options: [
          { value: 'auto', textKey: 'camera-setting-auto' },
          { value: 'high', textKey: 'camera-audio-quality-high' },
        ],
        value: 'auto',
      },
      {
        key: 'audioMode',
        labelKey: 'camera-audio-mode',
        hidden: false,
        options: [
          { value: 'voice', textKey: 'camera-audio-mode-voice' },
          { value: 'music', textKey: 'camera-audio-mode-music' },
        ],
        value: 'music',
      },
    ]);
  });

  it('audio sections show only on the video tab with audio on', () => {
    for (const overrides of [{ tab: 'photo' as const }, { audioEnabled: false }]) {
      const view = deriveSettingsView(input(overrides));
      expect(section(view, 'audioQuality')?.hidden).toBe(true);
      expect(section(view, 'audioMode')?.hidden).toBe(true);
    }
    const view = deriveSettingsView(input());
    expect(section(view, 'audioQuality')?.hidden).toBe(false);
    expect(section(view, 'audioMode')?.hidden).toBe(false);
  });

  it('a lone option list hides its section', () => {
    const base = input();
    const view = deriveSettingsView(
      input({
        settings: {
          ...base.settings,
          aspectRatioOptions: ['16:9'],
          resolutionOptions: ['720p'],
          audioQualityOptions: ['high'],
          audioModeOptions: [],
        },
      }),
    );
    for (const key of ['aspectRatio', 'resolution', 'audioQuality', 'audioMode']) {
      expect(section(view, key)?.hidden).toBe(true);
    }
  });

  it('the popup hides when not live, not granted, or every section hidden', () => {
    expect(deriveSettingsView(input({ phase: 'shot' })).hidden).toBe(true);
    expect(deriveSettingsView(input({ permission: 'prompt' })).hidden).toBe(true);
    const base = input();
    const allHidden = input({
      view: { ...base.view, cameraSelectHidden: true, audioSelectHidden: true },
      tab: 'photo',
      settings: { ...base.settings, aspectRatioOptions: ['16:9'], resolutionOptions: ['720p'] },
    });
    expect(deriveSettingsView(allHidden).hidden).toBe(true);
  });

  it("the native ratio carries shape 'native' and its text key", () => {
    expect(section(deriveSettingsView(input()), 'aspectRatio')?.options[0]).toEqual({
      value: 'native',
      textKey: 'camera-aspect-ratio-native',
      shape: 'native',
    });
  });
});
