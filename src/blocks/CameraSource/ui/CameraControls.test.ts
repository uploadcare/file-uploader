import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploaderRegistry } from '../../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../../lit/ensureUploaderCtx';
import { delay } from '../../../utils/delay';
import type { CameraPhase } from '../CameraSession';
import { RecordingClock } from '../media/RecordingClock';
import { CameraActionEvent } from './CameraActionEvent';
import { CameraControls } from './CameraControls';
import { deriveCameraView } from './cameraView';

CameraControls.reg('uc-camera-controls');

const ctxName = 'camera-controls-spec';
const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  UploaderRegistry.dispose(ctxName);
});

const mount = async (
  clock: RecordingClock,
  parent: HTMLElement = document.body,
  phase: CameraPhase = 'recording',
): Promise<CameraControls> => {
  ensureUploaderCtx(ctxName);
  const el = document.createElement('uc-camera-controls');
  el.setAttribute('ctx-name', ctxName);
  el.view = deriveCameraView({
    permission: 'granted',
    phase,
    tab: 'video',
    cameraModes: ['photo', 'video'],
    audioEnabled: true,
    cameraCount: 1,
    microphoneCount: 1,
    muted: false,
    microphoneDenied: false,
  });
  el.clock = clock;
  parent.append(el);
  mounted.push(parent === document.body ? el : parent);
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

  it("doesn't submit the page's form when the clip's play button is clicked", async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const submit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener('submit', submit);
    const el = await mount(new RecordingClock(), form, 'recorded');
    const play = el.querySelector<HTMLButtonElement>('[data-testid="recording-timer"]');
    expect(play?.disabled).toBe(false);

    play?.click();

    expect(submit).not.toHaveBeenCalled();
  });

  it('names the clip button after what a press does, play or pause', async () => {
    const el = await mount(new RecordingClock(), document.body, 'recorded');
    const timer = () => el.querySelector('[data-testid="recording-timer"]');
    expect(timer()?.getAttribute('aria-label')).toBe('Play');

    el.timelineIcon = 'pause';
    await el.updateComplete;

    expect(timer()?.getAttribute('aria-label')).toBe('Pause');
  });

  it('disables the clip button while recording and enables it once the clip is in', async () => {
    const recording = await mount(new RecordingClock());
    expect(recording.querySelector<HTMLButtonElement>('[data-testid="recording-timer"]')?.disabled).toBe(true);

    const recorded = await mount(new RecordingClock(), document.body, 'recorded');
    expect(recorded.querySelector<HTMLButtonElement>('[data-testid="recording-timer"]')?.disabled).toBe(false);
  });

  it('labels the crossed-out microphone with why while its access is denied', async () => {
    const el = await mount(new RecordingClock(), document.body, 'live');
    el.view = deriveCameraView({
      permission: 'granted',
      phase: 'live',
      tab: 'video',
      cameraModes: ['photo', 'video'],
      audioEnabled: true,
      cameraCount: 1,
      microphoneCount: 1,
      muted: false,
      microphoneDenied: true,
    });
    await el.updateComplete;

    const button = el.querySelector('[data-testid="toggle-microphone"]');
    expect(button?.getAttribute('aria-label')).toBe('Microphone access denied');
    expect(button?.getAttribute('aria-pressed')).toBe('false');
    expect(button?.querySelector('uc-icon')?.getAttribute('name')).toBe('microphone-mute');
  });

  it.each([
    [true, 'true', 0],
    [false, 'false', 1],
  ] as const)('with the microphone denied: %s, its button is aria-disabled %s and a click sends %i actions', async (microphoneDenied, ariaDisabled, sent) => {
    const el = await mount(new RecordingClock(), document.body, 'live');
    el.view = deriveCameraView({
      permission: 'granted',
      phase: 'live',
      tab: 'video',
      cameraModes: ['photo', 'video'],
      audioEnabled: true,
      cameraCount: 1,
      microphoneCount: 1,
      muted: false,
      microphoneDenied,
    });
    await el.updateComplete;
    const actions = vi.fn();
    el.addEventListener(CameraActionEvent.eventName, actions);

    const button = el.querySelector<HTMLButtonElement>('[data-testid="toggle-microphone"]');
    button?.click();

    expect(button?.getAttribute('aria-disabled')).toBe(ariaDisabled);
    // Still focusable, so its label can be read.
    expect(button?.disabled).toBe(false);
    expect(actions).toHaveBeenCalledTimes(sent);
  });
});
