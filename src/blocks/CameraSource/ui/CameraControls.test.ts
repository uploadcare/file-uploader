import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploaderRegistry } from '../../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../../lit/ensureUploaderCtx';
import { delay } from '../../../utils/delay';
import { RecordingClock } from '../media/RecordingClock';
import { CameraControls } from './CameraControls';
import { deriveCameraView } from './cameraView';

CameraControls.reg('uc-camera-controls');

const ctxName = 'camera-controls-spec';
const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  UploaderRegistry.dispose(ctxName);
});

const mount = async (clock: RecordingClock): Promise<CameraControls> => {
  ensureUploaderCtx(ctxName);
  const el = document.createElement('uc-camera-controls');
  el.setAttribute('ctx-name', ctxName);
  el.view = deriveCameraView({
    permission: 'granted',
    phase: 'recording',
    tab: 'video',
    cameraModes: ['photo', 'video'],
    audioEnabled: true,
    cameraCount: 1,
    microphoneCount: 1,
    muted: false,
  });
  el.clock = clock;
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
};

/** Lets the signal watcher schedule the update, then waits for it. */
const rendered = async (el: CameraControls): Promise<void> => {
  await delay(0);
  await el.updateComplete;
};

const timerText = (el: CameraControls) => el.querySelector('.uc-recording-timer span:not(.uc-line)')?.textContent;
const line = (el: CameraControls) => el.querySelector<HTMLElement>('.uc-line');

describe('CameraControls', () => {
  it('renders the timer text from the clock', async () => {
    const clock = new RecordingClock();
    const el = await mount(clock);
    expect(el.querySelector('.uc-recording-timer')?.hasAttribute('hidden')).toBe(false);
    expect(timerText(el)).toBe('00:00');

    clock.timerText = '00:07';
    await rendered(el);

    expect(timerText(el)).toBe('00:07');
  });

  it('scales the timeline by the clock progress, and leaves it untransformed while there is none', async () => {
    const clock = new RecordingClock();
    const el = await mount(clock);
    expect(line(el)?.style.transform).toBe('');

    clock.progress = 0.25;
    await rendered(el);

    expect(line(el)?.style.transform).toBe('scaleX(0.25)');
  });

  it('moves the timeline on a progress change without re-rendering the controls', async () => {
    const clock = new RecordingClock();
    const el = await mount(clock);
    const render = vi.spyOn(el, 'render');

    clock.progress = 0.5;
    await rendered(el);
    clock.progress = 0.75;
    await rendered(el);

    expect(line(el)?.style.transform).toBe('scaleX(0.75)');
    expect(render).not.toHaveBeenCalled();
  });
});
