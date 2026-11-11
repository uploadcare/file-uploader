import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraDevices, type CameraDevicesHost } from './CameraDevices';

const host = (overrides: Partial<CameraDevicesHost> = {}) => {
  const controller = new AbortController();
  const fns = {
    lifetime: {
      whileAdopted: <T>(work: PromiseLike<T>) => Promise.resolve(work),
      runTask: vi.fn((task: () => unknown) => {
        void task();
      }),
      adoptionSignal: () => controller.signal,
    },
    audioEnabled: () => true,
    cameraLabel: (index: number) => `Camera ${index + 1}`,
    onDevicesChange: vi.fn(),
    report: vi.fn(),
    ...overrides,
  };
  return { fns, devices: new CameraDevices(fns), abort: () => controller.abort() };
};

const device = (kind: MediaDeviceKind, deviceId: string, label = '') => ({ kind, deviceId, label }) as MediaDeviceInfo;

const stubMedia = (devices: MediaDeviceInfo[]) => {
  const track = { stop: vi.fn() };
  const mediaDevices = Object.assign(new EventTarget(), {
    getUserMedia: vi.fn(async () => ({ getTracks: () => [track] }) as unknown as MediaStream),
    enumerateDevices: vi.fn(async () => devices),
  });
  vi.stubGlobal('navigator', { ...navigator, mediaDevices });
  return { mediaDevices, track };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CameraDevices.list', () => {
  it('lists cameras, naming unlabelled ones, and microphones', async () => {
    stubMedia([device('videoinput', 'c1', ' Front '), device('videoinput', 'c2'), device('audioinput', 'm1', 'Mic')]);
    const { fns, devices } = host();

    await devices.list();

    expect(fns.onDevicesChange).toHaveBeenCalledWith({
      cameras: [
        { text: 'Front', value: 'c1' },
        { text: 'Camera 2', value: 'c2' },
      ],
      microphones: [{ text: 'Mic', value: 'm1' }],
    });
  });

  it('lists no microphones when audio recording is off', async () => {
    stubMedia([device('videoinput', 'c1'), device('audioinput', 'm1', 'Mic')]);
    const { fns, devices } = host({ audioEnabled: () => false });

    await devices.list();

    expect(fns.onDevicesChange).toHaveBeenCalledWith({ cameras: [{ text: 'Camera 1', value: 'c1' }], microphones: [] });
  });
});

describe('CameraDevices.watchDeviceChanges', () => {
  it('lists the devices again on a device change, until the adoption ends', async () => {
    const { mediaDevices } = stubMedia([device('videoinput', 'c1')]);
    const { fns, devices, abort } = host();

    devices.watchDeviceChanges();
    mediaDevices.dispatchEvent(new Event('devicechange'));
    await Promise.resolve();
    expect(fns.onDevicesChange).toHaveBeenCalledTimes(1);

    abort();
    mediaDevices.dispatchEvent(new Event('devicechange'));
    await Promise.resolve();
    expect(fns.onDevicesChange).toHaveBeenCalledTimes(1);
  });
});

describe('CameraDevices.adopt', () => {
  const trackOn = (deviceId: string) => ({ getSettings: () => ({ deviceId }) }) as MediaStreamTrack;
  const stream = (camera: string, microphone: string) =>
    ({
      getVideoTracks: () => [trackOn(camera)],
      getAudioTracks: () => [trackOn(microphone)],
    }) as unknown as MediaStream;
  const lists = {
    cameras: [
      { text: 'A', value: 'c1' },
      { text: 'B', value: 'c2' },
      { text: 'C', value: 'c3' },
    ],
    microphones: [
      { text: 'M1', value: 'm1' },
      { text: 'M2', value: 'm2' },
    ],
  };

  it('adopt keeps a listed choice, else the device in use, else the first', () => {
    const { devices } = host();

    devices.adopt(lists, null);
    expect(devices.cameras).toBe(lists.cameras);
    expect(devices.microphones).toBe(lists.microphones);
    expect([devices.selectedCameraId, devices.selectedMicrophoneId]).toEqual(['c1', 'm1']);

    devices.pickCamera('gone');
    devices.pickMicrophone('gone');
    devices.adopt(lists, stream('c2', 'm2'));
    expect([devices.selectedCameraId, devices.selectedMicrophoneId]).toEqual(['c2', 'm2']);

    devices.pickCamera('c3');
    devices.adopt(lists, stream('c2', 'm2'));
    expect(devices.selectedCameraId).toBe('c3');
  });
});
