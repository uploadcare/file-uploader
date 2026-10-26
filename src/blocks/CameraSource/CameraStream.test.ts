import { describe, expect, it } from 'vitest';
import { cameraConstraints } from './CameraStream';

describe('cameraConstraints', () => {
  it('asks for the default video size with no device chosen', () => {
    expect(cameraConstraints({ cameraId: null, microphoneId: null, audio: true })).toEqual({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
      audio: {},
    });
  });

  it('pins the chosen camera and microphone', () => {
    expect(cameraConstraints({ cameraId: 'cam', microphoneId: 'mic', audio: true })).toEqual({
      video: { deviceId: { exact: 'cam' } },
      audio: { deviceId: { exact: 'mic' } },
    });
  });

  it('asks for no audio when recording it is off, whatever microphone is chosen', () => {
    expect(cameraConstraints({ cameraId: null, microphoneId: 'mic', audio: false }).audio).toBe(false);
  });
});
