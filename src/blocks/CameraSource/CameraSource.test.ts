import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { delay } from '../../utils/delay';
import { CameraSession } from './CameraSession';
import { CameraSource } from './CameraSource';
import { CameraActionEvent } from './ui/CameraActionEvent';

// Idempotent (same path as defineComponents(UC)).
CameraSource.reg('uc-camera-source');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `camera-source-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

const mount = async (ctxName: string): Promise<{ el: CameraSource; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-camera-source') as CameraSource;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, config };
};

/** A camera with one video track, and a recorder that hands its clip over on its `stop` event. */
const stubCamera = () => {
  const track = Object.assign(new EventTarget(), {
    kind: 'video',
    enabled: true,
    stop: vi.fn(),
    applyConstraints: vi.fn(async () => {}),
    getSettings: () => ({ deviceId: 'cam-1' }),
    getCapabilities: () => ({}),
  });
  // A real `MediaStream`, which the preview's `<video>` takes as its `srcObject`, with the fake track.
  const getUserMedia = vi.fn(async () =>
    Object.assign(new MediaStream(), {
      getTracks: () => [track],
      getVideoTracks: () => [track],
      getAudioTracks: () => [],
    }),
  );
  const mediaDevices = Object.assign(new EventTarget(), { getUserMedia, enumerateDevices: vi.fn(async () => []) });
  const permissions = { query: async () => new EventTarget() };
  vi.stubGlobal('navigator', { ...navigator, mediaDevices, permissions });
  class FakeRecorder extends EventTarget {
    public static last: FakeRecorder;
    public static isTypeSupported = () => true;
    public state: RecordingState = 'inactive';
    public mimeType = 'video/webm';
    public constructor() {
      super();
      FakeRecorder.last = this;
    }
    public start(): void {
      this.state = 'recording';
    }
    public stop(): void {
      this.state = 'inactive';
    }
  }
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:clip');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  return { recorder: () => FakeRecorder.last };
};

const videoEl = (el: CameraSource): HTMLVideoElement | null => el.querySelector('video');
const shotButton = (el: CameraSource) => el.querySelector<HTMLButtonElement>('[data-testid="shot"]');
const retakeButton = (el: CameraSource) => el.querySelector<HTMLButtonElement>('.uc-camera-actions .uc-secondary-btn');
const actionsShown = (el: CameraSource) => el.querySelector('.uc-camera-actions')?.hasAttribute('hidden') === false;
const timerShown = (el: CameraSource) =>
  el.querySelector('[data-testid="recording-timer"]')?.hasAttribute('hidden') === false;

/** The preview's `<video>` draws its first frame, which the shutter waits for. */
const firstFrame = async (el: CameraSource): Promise<void> => {
  videoEl(el)?.dispatchEvent(new Event('loadeddata'));
  await vi.waitFor(() => expect(shotButton(el)?.disabled).toBe(false));
};

describe('CameraSource', () => {
  it('re-renders the video transform reactively when cameraMirror changes (getTracked, no subConfigValue)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);
    // Default cameraMirror is false -> no mirror transform. (happy-dom serializes
    // an omitted styleMap value inconsistently, so assert on the mirror token.)
    expect(videoEl(el)?.style.transform).not.toContain('scaleX(-1)');

    // External config change; the tracked `cameraMirror` read in the
    // `_videoTransformCss` getter re-renders the video transform.
    config.set('cameraMirror', true);
    await el.updateComplete;
    await delay(0);
    expect(videoEl(el)?.style.transform).toContain('scaleX(-1)');

    config.set('cameraMirror', false);
    await el.updateComplete;
    await delay(0);
    expect(videoEl(el)?.style.transform).not.toContain('scaleX(-1)');
  });

  it('hands an enableAudioRecording change to the session', async () => {
    const { config } = await mount(freshCtxName());
    const configChanged = vi.spyOn(CameraSession.prototype, 'configChanged').mockImplementation(() => {});

    config.set('enableAudioRecording', false);

    expect(configChanged).toHaveBeenCalledWith('audioEnabled');
    configChanged.mockRestore();
  });

  it('derives uc-initialized and uc-recording from the session, dropping uc-recording as stop is pressed and on release', async () => {
    const { recorder } = stubCamera();
    const { el, config } = await mount(freshCtxName());
    config.set('cameraModes', 'video');
    const classes = () => ['uc-initialized', 'uc-recording'].filter((name) => el.classList.contains(name));
    expect(classes()).toEqual([]);

    await vi.waitFor(() => expect(classes()).toEqual(['uc-initialized']));
    await firstFrame(el);
    shotButton(el)?.click();
    await vi.waitFor(() => expect(classes()).toEqual(['uc-initialized', 'uc-recording']));

    // Stop is pressed, and the clip is still on its way: no accept and retake yet.
    shotButton(el)?.click();
    await el.updateComplete;
    expect(actionsShown(el)).toBe(false);
    expect(classes()).toEqual(['uc-initialized']);

    recorder().dispatchEvent(new Event('stop'));
    await vi.waitFor(() => expect(actionsShown(el)).toBe(true));
    retakeButton(el)?.click();
    await vi.waitFor(() => expect(shotButton(el)?.hidden).toBe(false));
    // The live stream is back in the `<video>`, which draws its first frame again.
    await firstFrame(el);
    shotButton(el)?.click();
    await vi.waitFor(() => expect(classes()).toEqual(['uc-initialized', 'uc-recording']));

    // A same-task move releases the session mid-recording and re-adopts the element.
    document.body.append(el);
    await el.updateComplete;
    expect(timerShown(el)).toBe(false);
    expect(classes()).toEqual(['uc-initialized']);
  });

  it("shows the camera's stream in the preview's video", async () => {
    stubCamera();
    const { el } = await mount(freshCtxName());

    await vi.waitFor(() => expect(videoEl(el)?.srcObject).toBeInstanceOf(MediaStream));
  });

  it("enables the shutter once the preview's video has a frame, and disables it when the video empties", async () => {
    stubCamera();
    const { el } = await mount(freshCtxName());
    await vi.waitFor(() => expect(el.classList.contains('uc-initialized')).toBe(true));
    expect(shotButton(el)?.disabled).toBe(true);

    await firstFrame(el);

    videoEl(el)?.dispatchEvent(new Event('emptied'));
    await vi.waitFor(() => expect(shotButton(el)?.disabled).toBe(true));
  });

  it("draws the native ratio's icon in the camera's own shape once the preview reports it", async () => {
    stubCamera();
    const { el, config } = await mount(freshCtxName());
    config.set('cameraAspectRatio', 'native, 1:1');
    await vi.waitFor(() => expect(el.classList.contains('uc-initialized')).toBe(true));
    const nativeRect = () => el.querySelector('input[value="native"]')?.closest('label')?.querySelector('svg rect');
    await el.updateComplete;
    expect(nativeRect()).toBeFalsy();

    const video = videoEl(el);
    if (!video) throw new Error('no preview video');
    Object.defineProperties(video, { videoWidth: { value: 1280 }, videoHeight: { value: 720 } });
    video.dispatchEvent(new Event('resize'));

    await vi.waitFor(() =>
      expect([nativeRect()?.getAttribute('width'), nativeRect()?.getAttribute('height')]).toEqual(['12', '7']),
    );
  });

  it("keeps the camera's internal actions inside it", async () => {
    stubCamera();
    const leaked: string[] = [];
    const listen = (event: Event) => {
      if (event instanceof CameraActionEvent) leaked.push(event.action.type);
    };
    document.addEventListener(CameraActionEvent.eventName, listen);
    try {
      const { el, config } = await mount(freshCtxName());
      // Video, as a photo would need a canvas context happy-dom lacks.
      config.set('cameraModes', 'video');
      await vi.waitFor(() => expect(el.classList.contains('uc-initialized')).toBe(true));

      await firstFrame(el);
      shotButton(el)?.click();
      await vi.waitFor(() => expect(el.classList.contains('uc-recording')).toBe(true));
    } finally {
      document.removeEventListener(CameraActionEvent.eventName, listen);
    }

    expect(leaked).toEqual([]);
  });
});
