import { afterEach, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, UploadCtxProvider } from '@/index.ts';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

// M9g Task 1 — additive parity e2e pinning current v1 behavior of
// `uc-camera-source` (src/blocks/CameraSource/CameraSource.ts) ahead of its
// `LitUploaderBlock` port. Mounts the regular solution +
// `<uc-upload-ctx-provider>` (same composition as tests/blocks/url-source.e2e.test.tsx)
// and reaches the activity via the real "Camera" start-from button. Chromium
// runs with the fake media-stream flags (vitest.config.ts), so the
// `getUserMedia`/permissions-API 'granted' path works headlessly. Kept
// shallow per the M9g brief — pins the block's own render surface (video
// element + shot button + granted state), not the shot/record/accept bridge
// internals already covered by tests/plugins/camera-source.e2e.test.tsx and
// tests/file-uploader-regular.e2e.test.tsx's "from camera" case.

const renderRegularHost = () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
  const config = page.getByTestId('uc-config').query()! as Config;
  const provider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
  return { ctxName, config, api: provider.api };
};

const navigateToCameraSource = async () => {
  await page.getByText('Upload files', { exact: true }).click();
  const startFrom = page.getByTestId('uc-start-from');
  await expect.element(startFrom).toBeVisible();
  await startFrom.getByText('Camera', { exact: true }).click();
  const cameraSource = page.getByTestId('uc-camera-source');
  await expect.element(cameraSource).toBeVisible();
  return cameraSource;
};

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('uc-camera-source (parity, render surface + permissions)', () => {
  it('renders the video element and the shot button once permissions are granted', async () => {
    renderRegularHost();
    const cameraSource = await navigateToCameraSource();

    // Permissions flow reaches 'granted' (fake-media-stream Chromium flags):
    // the host gets `.uc-initialized` and the video/shot-button `hidden`
    // attributes clear (CameraSource.ts's `_setPermissionsState('granted')`).
    await expect
      .poll(() => document.querySelector('uc-camera-source')?.classList.contains('uc-initialized'))
      .toBe(true);

    await expect.element(cameraSource.getByTestId('uc-camera-controls--shot')).toBeVisible();

    const video = document.querySelector('uc-camera-source video');
    expect(video).toBeTruthy();
    await expect.poll(() => video?.hasAttribute('hidden')).toBe(false);
  });

  it('keeps the shutter disabled until the video has a frame', async () => {
    // A canvas captured at 0 fps sends no frame until asked, standing in for a camera that is slow to deliver one.
    // A shot taken before then drew an empty canvas, and accepting it added nothing.
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const stream = canvas.captureStream(0);
    const [track] = stream.getVideoTracks() as CanvasCaptureMediaStreamTrack[];
    onTestFinished(() => track?.stop());
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockImplementation(async () => stream.clone());
    renderRegularHost();
    const cameraSource = await navigateToCameraSource();
    const shutter = cameraSource.getByTestId('uc-camera-controls--shot');
    await expect.element(shutter).toBeVisible();
    await expect.element(shutter).toBeDisabled();

    const context = canvas.getContext('2d');
    if (context) context.fillRect(0, 0, 64, 48);
    const video = document.querySelector('uc-camera-source video') as HTMLVideoElement;
    for (const live of (video.srcObject as MediaStream).getVideoTracks() as CanvasCaptureMediaStreamTrack[]) {
      live.requestFrame();
    }
    track?.requestFrame();

    await expect.element(shutter).toBeEnabled();
  });

  it('reflects data-testid under testMode', async () => {
    renderRegularHost();
    await navigateToCameraSource();

    expect(document.querySelector('uc-camera-source')?.getAttribute('data-testid')).toBe('uc-camera-source');
  });
});

describe('uc-camera-source (device selection)', () => {
  // The fake-media Chromium exposes one camera, so the device list is stubbed to two. `getUserMedia` is wrapped so
  // the stubbed ids still open the real fake stream, and the requested constraints can be read back.
  const device = (kind: MediaDeviceKind, deviceId: string, label: string) =>
    ({ kind, deviceId, label, groupId: '' }) as MediaDeviceInfo;
  let devices: MediaDeviceInfo[] = [];

  const stubDevices = () => {
    devices = [device('videoinput', 'cam-a', 'Camera A'), device('videoinput', 'cam-b', 'Camera B')];
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockImplementation(async () => devices);
    const realGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    return vi
      .spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockImplementation((constraints) => realGetUserMedia({ video: true, audio: Boolean(constraints?.audio) }));
  };

  const requestedCameraId = (getUserMedia: ReturnType<typeof stubDevices>) => {
    const video = getUserMedia.mock.lastCall?.[0]?.video;
    return typeof video === 'object' ? (video.deviceId as ConstrainDOMStringParameters | undefined)?.exact : undefined;
  };

  const cameraSelect = () => document.querySelector('uc-camera-source .uc-camera-select select') as HTMLSelectElement;

  const pickCamera = async (deviceId: string) => {
    await expect.poll(() => cameraSelect()?.querySelectorAll('option').length).toBe(devices.length);
    cameraSelect().value = deviceId;
    cameraSelect().dispatchEvent(new Event('change'));
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stops the previous stream when another camera is picked', async () => {
    const getUserMedia = stubDevices();
    // Opened ahead and handed back at once, as a camera that is already warm answers: the switch must not rely on
    // `getUserMedia` being slow for the old stream to be stopped.
    const warm = await navigator.mediaDevices.getUserMedia({ video: true });
    onTestFinished(() => {
      for (const track of warm.getTracks()) track.stop();
    });
    renderRegularHost();
    await navigateToCameraSource();
    const video = () => document.querySelector('uc-camera-source video') as HTMLVideoElement | null;
    await expect.poll(() => video()?.srcObject instanceof MediaStream).toBe(true);
    const first = video()?.srcObject as MediaStream;
    getUserMedia.mockImplementation(async () => warm);

    await pickCamera('cam-b');
    // The sentinel: the new stream is on the video, so the switch has fully happened.
    await expect.poll(() => video()?.srcObject).toBe(warm);

    expect(first.getTracks().map((track) => track.readyState)).toEqual(first.getTracks().map(() => 'ended'));
  });

  it('keeps the picked camera across a devicechange that still lists it', async () => {
    const getUserMedia = stubDevices();
    renderRegularHost();
    await navigateToCameraSource();

    await pickCamera('cam-b');
    await expect.poll(() => requestedCameraId(getUserMedia)).toBe('cam-b');

    devices = [...devices, device('audioinput', 'mic-a', 'Headset')];
    navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
    const audioSelect = document.querySelector('uc-camera-source uc-select.uc-audio-select')!;
    await expect.poll(() => audioSelect.querySelectorAll('option').length).toBe(1);

    // Any later recapture (here the audio select; a permission change does the same) must reopen the camera in use.
    getUserMedia.mockClear();
    audioSelect.dispatchEvent(new Event('change'));
    await expect.poll(() => getUserMedia.mock.calls.length).toBe(1);
    expect(requestedCameraId(getUserMedia)).toBe('cam-b');
  });

  it('keeps showing the camera in use when a devicechange reorders the list', async () => {
    const getUserMedia = stubDevices();
    renderRegularHost();
    await navigateToCameraSource();
    await expect.poll(() => cameraSelect()?.querySelectorAll('option').length).toBe(2);
    await expect.poll(() => requestedCameraId(getUserMedia)).toBe('cam-a');

    devices = [devices[1]!, devices[0]!];
    navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
    await expect.poll(() => cameraSelect().options[0]?.value).toBe('cam-b');

    expect(cameraSelect().value).toBe('cam-a');
  });
});
