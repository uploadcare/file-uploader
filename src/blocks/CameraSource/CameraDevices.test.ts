import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraDevices, type CameraDevicesHost } from './CameraDevices';

const host = (overrides: Partial<CameraDevicesHost> = {}) => {
  const controller = new AbortController();
  const fns = {
    whileAdopted: <T>(work: PromiseLike<T>) => Promise.resolve(work),
    runTask: vi.fn((task: () => unknown) => {
      void task();
    }),
    adoptionSignal: () => controller.signal,
    audioEnabled: () => true,
    cameraLabel: (index: number) => `Camera ${index + 1}`,
    onPermissionChange: vi.fn(),
    onDevicesChange: vi.fn(),
    onError: vi.fn(),
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

describe('CameraDevices.requestAccess', () => {
  it('stops the probe stream, lists the devices and lists them again on a device change', async () => {
    const { mediaDevices, track } = stubMedia([device('videoinput', 'c1')]);
    const { fns, devices, abort } = host();

    await devices.requestAccess();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(fns.onDevicesChange).toHaveBeenCalledTimes(1);

    mediaDevices.dispatchEvent(new Event('devicechange'));
    await Promise.resolve();
    expect(fns.onDevicesChange).toHaveBeenCalledTimes(2);

    abort();
    mediaDevices.dispatchEvent(new Event('devicechange'));
    await Promise.resolve();
    expect(fns.onDevicesChange).toHaveBeenCalledTimes(2);
  });

  it('reports a refused probe instead of throwing', async () => {
    const { mediaDevices } = stubMedia([]);
    mediaDevices.getUserMedia.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    const { fns, devices } = host();

    await devices.requestAccess();

    expect(fns.onError).toHaveBeenCalledWith(
      expect.any(DOMException),
      'camera devices. Failed to get user media',
      'Failed to get user media',
    );
  });
});

describe('CameraDevices.watchPermissions', () => {
  const stubPermissions = (query: () => Promise<PermissionStatus>) =>
    vi.stubGlobal('navigator', { ...navigator, permissions: { query } });

  it('reports each permission change until it stops watching', async () => {
    const statuses: EventTarget[] = [];
    stubPermissions(async () => {
      const status = new EventTarget();
      statuses.push(status);
      return status as PermissionStatus;
    });
    const { fns, devices } = host();

    await expect(devices.watchPermissions()).resolves.toBe(true);
    for (const status of statuses) status.dispatchEvent(new Event('change'));
    expect(fns.onPermissionChange).toHaveBeenCalledTimes(2);

    devices.stopWatchingPermissions();
    for (const status of statuses) status.dispatchEvent(new Event('change'));
    expect(fns.onPermissionChange).toHaveBeenCalledTimes(2);
  });

  it('returns false and reports when the Permissions API fails', async () => {
    stubPermissions(async () => {
      throw new TypeError('camera is not a valid permission name');
    });
    const { fns, devices } = host();

    await expect(devices.watchPermissions()).resolves.toBe(false);
    expect(fns.onError).toHaveBeenCalledWith(
      expect.any(TypeError),
      'camera permissions. Failed to use permissions API',
      'Failed to use permissions API. Fallback to manual request mode.',
    );
  });

  it('lets an abort through', async () => {
    stubPermissions(async () => {
      throw new DOMException('gone', 'AbortError');
    });
    const { devices } = host();

    await expect(devices.watchPermissions()).rejects.toMatchObject({ name: 'AbortError' });
  });
});
