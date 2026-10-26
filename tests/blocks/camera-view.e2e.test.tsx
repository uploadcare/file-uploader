import { afterEach, describe, expect, it, vi } from 'vitest';
import { delay } from '@/utils/delay';
import { clickSource, renderSolution, within } from '~/tests/utils/render-solution';

/**
 * Characterization of everything the camera shows, step by step: which parts are hidden, the shutter's icon, class
 * and label, the message, and the host classes. Pins the current behaviour ahead of restructuring CameraSource.
 */

const camera = () => document.querySelector('uc-camera-source') as HTMLElement;
const part = (selector: string) => camera().querySelector<HTMLElement>(selector);
const shown = (selector: string) => {
  const el = part(selector);
  return el ? !el.hidden && !el.closest('[hidden]') : null;
};

const describeView = () => {
  const shot = part('[data-testid="uc-camera-source--shot"]');
  const mic = part('[data-testid="uc-camera-source--toggle-microphone"]');
  return {
    host: ['uc-initialized', 'uc-recording'].filter((c) => camera().classList.contains(c)).join(' ') || '-',
    video: shown('video'),
    message: shown('.uc-message-box') ? part('.uc-message-box span')?.textContent?.trim() : false,
    requestButton: shown('.uc-message-box button'),
    caption: shown('uc-activity-header > div'),
    cameraSelect: shown('.uc-camera-select'),
    tabs: `${shown('[data-testid="uc-camera-source--tab-photo"]') ? 'photo' : '-'} ${shown('[data-testid="uc-camera-source--tab-video"]') ? 'video' : '-'}`,
    activeTab: part('.uc-switch.uc-active')?.dataset.id ?? '-',
    switcher: shown('.uc-switcher'),
    timer: shown('[data-testid="uc-camera-source--recording-timer"]'),
    actions: shown('.uc-camera-actions'),
    shot: shown('[data-testid="uc-camera-source--shot"]')
      ? `${shot?.getAttribute('class')} icon=${shot?.querySelector('uc-icon')?.getAttribute('name')} "${shot?.getAttribute('aria-label')}"`
      : false,
    mic: shown('[data-testid="uc-camera-source--toggle-microphone"]')
      ? mic?.querySelector('uc-icon')?.getAttribute('name')
      : false,
    audioSelect: shown('.uc-audio-select')
      ? part('.uc-audio-select')?.hasAttribute('disabled')
        ? 'disabled'
        : 'enabled'
      : false,
  };
};

// The permission state is debounced by 300 ms; past it, every reaction to the last step has landed.
const settle = () => delay(400);

const open = async (config: Parameters<typeof renderSolution>[1] = {}) => {
  const { root, config: cfg } = await renderSolution('regular', config);
  await clickSource(root, 'Camera');
  await expect.poll(() => camera()?.classList.contains('uc-initialized')).toBe(true);
  await expect.poll(() => part('[data-testid="uc-camera-source--shot"]')?.hasAttribute('disabled')).toBe(false);
  await settle();
  return { root, config: cfg, view: within(camera()) };
};

const click = async (testId: string) => {
  part(`[data-testid="uc-camera-source--${testId}"]`)?.click();
  await settle();
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('camera view', () => {
  it('walks a photo, then a video', async () => {
    await open({ cameraModes: 'photo, video', enableAudioRecording: true });
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "photo",
        "audioSelect": false,
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized",
        "message": false,
        "mic": false,
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action icon=camera-full "Shot"",
        "switcher": true,
        "tabs": "photo video",
        "timer": false,
        "video": true,
      }
    `);

    await click('shot');
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": true,
        "activeTab": "photo",
        "audioSelect": false,
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized",
        "message": false,
        "mic": false,
        "requestButton": false,
        "shot": false,
        "switcher": true,
        "tabs": "- -",
        "timer": false,
        "video": true,
      }
    `);

    part('.uc-camera-actions .uc-secondary-btn')?.click();
    await settle();
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "photo",
        "audioSelect": false,
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized",
        "message": false,
        "mic": false,
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action icon=camera-full "Shot"",
        "switcher": true,
        "tabs": "photo video",
        "timer": false,
        "video": true,
      }
    `);

    await click('tab-video');
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "video",
        "audioSelect": "enabled",
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized",
        "message": false,
        "mic": "microphone",
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action icon=video-camera-full "Record Video"",
        "switcher": true,
        "tabs": "photo video",
        "timer": false,
        "video": true,
      }
    `);

    await click('shot');
    await expect.poll(() => camera().classList.contains('uc-recording')).toBe(true);
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "video",
        "audioSelect": false,
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized uc-recording",
        "message": false,
        "mic": "microphone",
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action uc-stop-record icon=square "Stop recording"",
        "switcher": false,
        "tabs": "- -",
        "timer": true,
        "video": true,
      }
    `);

    await click('shot');
    await expect.poll(() => shown('.uc-camera-actions')).toBe(true);
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": true,
        "activeTab": "video",
        "audioSelect": false,
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized",
        "message": false,
        "mic": false,
        "requestButton": false,
        "shot": false,
        "switcher": false,
        "tabs": "- -",
        "timer": true,
        "video": true,
      }
    `);

    part('.uc-camera-actions .uc-secondary-btn')?.click();
    await settle();
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "video",
        "audioSelect": "enabled",
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized",
        "message": false,
        "mic": "microphone",
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action icon=video-camera-full "Record Video"",
        "switcher": true,
        "tabs": "photo video",
        "timer": false,
        "video": true,
      }
    `);

    await click('tab-photo');
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "photo",
        "audioSelect": false,
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized",
        "message": false,
        "mic": false,
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action icon=camera-full "Shot"",
        "switcher": true,
        "tabs": "photo video",
        "timer": false,
        "video": true,
      }
    `);
  });

  it('mutes and unmutes the microphone on the video tab', async () => {
    await open({ cameraModes: 'video', enableAudioRecording: true });
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "video",
        "audioSelect": "enabled",
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized",
        "message": false,
        "mic": "microphone",
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action icon=video-camera-full "Record Video"",
        "switcher": true,
        "tabs": "- video",
        "timer": false,
        "video": true,
      }
    `);

    await click('toggle-microphone');
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "video",
        "audioSelect": "disabled",
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized",
        "message": false,
        "mic": "microphone-mute",
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action icon=video-camera-full "Record Video"",
        "switcher": true,
        "tabs": "- video",
        "timer": false,
        "video": true,
      }
    `);

    await click('toggle-microphone');
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "video",
        "audioSelect": "enabled",
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized",
        "message": false,
        "mic": "microphone",
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action icon=video-camera-full "Record Video"",
        "switcher": true,
        "tabs": "- video",
        "timer": false,
        "video": true,
      }
    `);
  });

  it.each([
    ['photo only', { cameraModes: 'photo', enableAudioRecording: true }],
    ['video only', { cameraModes: 'video', enableAudioRecording: true }],
    ['video without audio', { cameraModes: 'video, photo', enableAudioRecording: false }],
  ] as const)('opens with %s', async (_, config) => {
    await open(config);
    expect(describeView()).toMatchSnapshot();
  });

  it('follows cameraModes and enableAudioRecording changed while open', async () => {
    const { config } = await open({ cameraModes: 'photo, video', enableAudioRecording: true });
    await click('tab-video');

    config.enableAudioRecording = false;
    await settle();
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "video",
        "audioSelect": "disabled",
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized",
        "message": false,
        "mic": false,
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action icon=video-camera-full "Record Video"",
        "switcher": true,
        "tabs": "photo video",
        "timer": false,
        "video": true,
      }
    `);

    config.enableAudioRecording = true;
    await settle();
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "video",
        "audioSelect": "enabled",
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized",
        "message": false,
        "mic": "microphone",
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action icon=video-camera-full "Record Video"",
        "switcher": true,
        "tabs": "photo video",
        "timer": false,
        "video": true,
      }
    `);

    config.cameraModes = 'photo';
    await settle();
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "photo",
        "audioSelect": false,
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized",
        "message": false,
        "mic": false,
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action icon=camera-full "Shot"",
        "switcher": true,
        "tabs": "photo -",
        "timer": false,
        "video": true,
      }
    `);
  });

  it('shows the camera picker for two cameras', async () => {
    const device = (kind: MediaDeviceKind, deviceId: string, label: string) =>
      ({ kind, deviceId, label, groupId: '' }) as MediaDeviceInfo;
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockImplementation(async () => [
      device('videoinput', 'cam-a', 'Camera A'),
      device('videoinput', 'cam-b', 'Camera B'),
      device('audioinput', 'mic-a', 'Mic A'),
      device('audioinput', 'mic-b', 'Mic B'),
    ]);
    const realGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockImplementation((constraints) =>
      realGetUserMedia({ video: true, audio: Boolean(constraints?.audio) }),
    );
    await open({ cameraModes: 'photo, video', enableAudioRecording: true });
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "photo",
        "audioSelect": false,
        "cameraSelect": true,
        "caption": false,
        "host": "uc-initialized",
        "message": false,
        "mic": false,
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action icon=camera-full "Shot"",
        "switcher": true,
        "tabs": "photo video",
        "timer": false,
        "video": true,
      }
    `);

    await click('tab-video');
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "video",
        "audioSelect": "enabled",
        "cameraSelect": true,
        "caption": false,
        "host": "uc-initialized",
        "message": false,
        "mic": "microphone",
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action icon=video-camera-full "Record Video"",
        "switcher": true,
        "tabs": "photo video",
        "timer": false,
        "video": true,
      }
    `);

    await click('shot');
    await expect.poll(() => camera().classList.contains('uc-recording')).toBe(true);
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "video",
        "audioSelect": false,
        "cameraSelect": false,
        "caption": true,
        "host": "uc-initialized uc-recording",
        "message": false,
        "mic": "microphone",
        "requestButton": false,
        "shot": "uc-shot-btn uc-camera-action uc-stop-record icon=square "Stop recording"",
        "switcher": false,
        "tabs": "- -",
        "timer": true,
        "video": true,
      }
    `);
  });

  it('shows the denied message when the camera cannot start', async () => {
    const realGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let calls = 0;
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockImplementation((constraints) => {
      // The first call only probes for device labels; the camera itself is the second.
      calls += 1;
      return calls === 1
        ? realGetUserMedia(constraints)
        : Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });
    const { root } = await renderSolution('regular', { cameraModes: 'photo, video' });
    await clickSource(root, 'Camera');
    await expect.poll(() => shown('.uc-message-box')).toBe(true);
    await settle();
    expect(describeView()).toMatchInlineSnapshot(`
      {
        "actions": false,
        "activeTab": "photo",
        "audioSelect": "enabled",
        "cameraSelect": false,
        "caption": true,
        "host": "-",
        "message": "Camera access denied",
        "mic": false,
        "requestButton": false,
        "shot": false,
        "switcher": true,
        "tabs": "photo video",
        "timer": false,
        "video": false,
      }
    `);
  });
});
