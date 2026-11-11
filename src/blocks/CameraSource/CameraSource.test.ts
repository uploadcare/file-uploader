import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { delay } from '../../utils/delay';
import { CameraSession } from './CameraSession';
import { CameraSource } from './CameraSource';

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
    const session = el['_session'];
    const classes = () => ['uc-initialized', 'uc-recording'].filter((name) => el.classList.contains(name));
    expect(classes()).toEqual([]);

    await vi.waitFor(() => expect(classes()).toEqual(['uc-initialized']));
    session.handle({ type: 'shutter' });
    await vi.waitFor(() => expect(classes()).toEqual(['uc-initialized', 'uc-recording']));

    session.handle({ type: 'shutter' });
    await el.updateComplete;
    expect(session.phase).toBe('recording');
    expect(classes()).toEqual(['uc-initialized']);

    recorder().dispatchEvent(new Event('stop'));
    await vi.waitFor(() => expect(session.phase).toBe('recorded'));
    session.handle({ type: 'retake' });
    session.handle({ type: 'shutter' });
    await vi.waitFor(() => expect(classes()).toEqual(['uc-initialized', 'uc-recording']));

    // A same-task move releases the session mid-recording and re-adopts the element.
    document.body.append(el);
    await el.updateComplete;
    expect(session.phase).toBe('live');
    expect(classes()).toEqual(['uc-initialized']);
  });
});
