import { describe, expect, it } from 'vitest';
import { type CameraViewInput, cameraFailureOf, deriveCameraView } from './cameraView';

const input = (overrides: Partial<CameraViewInput> = {}): CameraViewInput => ({
  permission: 'granted',
  phase: 'live',
  tab: 'photo',
  cameraModes: ['photo', 'video'],
  audioEnabled: true,
  cameraCount: 1,
  microphoneCount: 2,
  muted: false,
  ...overrides,
});

describe('deriveCameraView', () => {
  it('shows the live preview with the tabs and the shutter once access is granted', () => {
    expect(deriveCameraView(input())).toMatchObject({
      videoHidden: false,
      messageHidden: true,
      photoTabHidden: false,
      videoTabHidden: false,
      timerHidden: true,
      actionsHidden: true,
      shotHidden: false,
      shotIcon: 'camera-full',
      shotClass: 'uc-shot-btn uc-camera-action',
    });
  });

  it.each([
    ['idle', { videoHidden: true, messageHidden: true, shotHidden: true }],
    ['prompt', { videoHidden: true, messageHidden: false, message: 'camera-permissions-prompt', photoTabHidden: true }],
    [
      'denied',
      { videoHidden: true, messageHidden: false, message: 'camera-permissions-denied', photoTabHidden: false },
    ],
  ] as const)('while access is %s', (permission, view) => {
    expect(deriveCameraView(input({ permission }))).toMatchObject(view);
  });

  it('swaps the shutter for accept and retake once a photo is taken', () => {
    expect(deriveCameraView(input({ phase: 'shot' }))).toMatchObject({
      shotHidden: true,
      actionsHidden: false,
      photoTabHidden: true,
      videoTabHidden: true,
      cameraSelectHidden: true,
    });
  });

  it('shows the timer and a stop shutter while recording, and accept and retake after', () => {
    const recording = deriveCameraView(input({ tab: 'video', phase: 'recording' }));
    expect(recording).toMatchObject({
      timerHidden: false,
      shotIcon: 'square',
      shotClass: 'uc-shot-btn uc-camera-action uc-stop-record',
      microphoneHidden: false,
      audioSelectHidden: true,
    });
    expect(deriveCameraView(input({ tab: 'video', phase: 'recorded' }))).toMatchObject({
      timerHidden: false,
      shotHidden: true,
      actionsHidden: false,
      microphoneHidden: true,
    });
  });

  it('shows a tab only for a configured camera mode', () => {
    expect(deriveCameraView(input({ cameraModes: ['video'] }))).toMatchObject({
      photoTabHidden: true,
      videoTabHidden: false,
    });
  });

  it('offers the camera picker for more than one camera, only on the live preview', () => {
    expect(deriveCameraView(input({ cameraCount: 2 })).cameraSelectHidden).toBe(false);
    expect(deriveCameraView(input({ cameraCount: 2, phase: 'shot' })).cameraSelectHidden).toBe(true);
    expect(deriveCameraView(input({ cameraCount: 1 })).cameraSelectHidden).toBe(true);
  });

  it.each([
    ['on the video tab with audio and two microphones', {}, false],
    ['on the photo tab', { tab: 'photo' }, true],
    ['with audio recording off', { audioEnabled: false }, true],
    ['with one microphone', { microphoneCount: 1 }, true],
    ['while recording', { phase: 'recording' }, true],
  ] as const)('hides the microphone picker %s: %s', (_, overrides, hidden) => {
    expect(deriveCameraView(input({ tab: 'video', ...overrides })).audioSelectHidden).toBe(hidden);
  });

  it('shows the mute button on the video tab with audio on, and reflects the mute', () => {
    expect(deriveCameraView(input({ tab: 'video' }))).toMatchObject({
      microphoneHidden: false,
      microphoneIcon: 'microphone',
      audioSelectDisabled: false,
    });
    expect(deriveCameraView(input({ tab: 'video', muted: true }))).toMatchObject({
      microphoneIcon: 'microphone-mute',
      audioSelectDisabled: true,
    });
    expect(deriveCameraView(input({ tab: 'photo' })).microphoneHidden).toBe(true);
    expect(deriveCameraView(input({ tab: 'video', audioEnabled: false })).microphoneHidden).toBe(true);
  });

  it('names the shutter icon after the tab', () => {
    expect(deriveCameraView(input({ tab: 'video' })).shotIcon).toBe('video-camera-full');
    expect(deriveCameraView(input({ tab: null })).shotIcon).toBe('camera-full');
  });
});

describe('a camera that could not start', () => {
  it.each([
    ['denied', 'camera-permissions-denied'],
    ['not-found', 'camera-not-found'],
    ['unavailable', 'camera-unavailable'],
  ] as const)('shows the %s message, laid out as denied', (failure, message) => {
    const view = deriveCameraView(input({ permission: 'denied', failure }));

    expect(view).toEqual({ ...deriveCameraView(input({ permission: 'denied' })), message });
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['NotReadableError', 'unavailable'],
    ['AbortError', 'unavailable'],
  ] as const)('reads a %s as %s', (name, failure) => {
    expect(cameraFailureOf(new DOMException('failed', name))).toBe(failure);
  });

  it('reads an error it does not know as unavailable', () => {
    expect(cameraFailureOf(new TypeError('boom'))).toBe('unavailable');
    expect(cameraFailureOf('nope')).toBe('unavailable');
  });
});
