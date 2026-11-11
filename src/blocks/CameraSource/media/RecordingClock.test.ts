import { Signal } from '@lit-labs/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingClock } from './RecordingClock';

let frames: FrameRequestCallback[] = [];
const runFrames = () => {
  const due = frames;
  frames = [];
  for (const frame of due) frame(0);
};

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame));
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('RecordingClock', () => {
  it('timerText reads the elapsed time and changes only when the shown text does', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const clock = new RecordingClock();
    let reads = 0;
    const shown = new Signal.Computed(() => {
      reads++;
      return clock.timerText;
    });
    expect(shown.get()).toBe('00:00');

    clock.startTimer(() => undefined, vi.fn());
    now.mockReturnValue(1200);
    runFrames();
    expect(shown.get()).toBe('00:01');
    now.mockReturnValue(1800);
    runFrames();
    expect(shown.get()).toBe('00:01');

    expect(reads).toBe(2);
    expect(clock.progress).toBeNull();
  });

  it('counts down to the limit and calls onLimit once', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const clock = new RecordingClock();
    const onLimit = vi.fn();

    clock.startTimer(() => 2, onLimit);
    expect(clock.timerText).toBe('00:02');
    now.mockReturnValue(2000);
    runFrames();
    runFrames();

    expect(clock.timerText).toBe('00:00');
    expect(onLimit).toHaveBeenCalledOnce();
    expect(frames).toEqual([]);
  });

  it('the timeline follows the sample and stop() halts both', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const clock = new RecordingClock();
    let playback: { currentTime: number; duration: number } | null = { currentTime: 1, duration: 4 };

    clock.startTimeline(() => playback);
    expect([clock.progress, clock.timerText]).toEqual([0.25, '00:01']);
    playback = { currentTime: 2, duration: 4 };
    runFrames();
    expect([clock.progress, clock.timerText]).toEqual([0.5, '00:02']);

    clock.stop();
    expect(frames).toEqual([]);

    clock.startTimer(() => undefined, vi.fn());
    now.mockReturnValue(5000);
    clock.stop();
    runFrames();
    expect(clock.timerText).toBe('00:00');

    playback = null;
    clock.startTimeline(() => playback);
    expect(frames).toEqual([]);
    expect(clock.progress).toBe(0.5);
  });

  it('starting the timeline while the timer runs replaces the timer loop', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const clock = new RecordingClock();
    clock.startTimer(() => undefined, vi.fn());

    clock.startTimeline(() => ({ currentTime: 0, duration: 4 }));
    expect(frames).toHaveLength(1);
    now.mockReturnValue(3000);
    runFrames();
    runFrames();

    expect(frames).toHaveLength(1);
    expect(clock.timerText).toBe('00:00');
  });

  it('the timer reads the limit on every tick', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const clock = new RecordingClock();
    const onLimit = vi.fn();
    let max = 10;

    clock.startTimer(() => max, onLimit);
    expect(clock.timerText).toBe('00:10');
    now.mockReturnValue(1000);
    max = 5;
    runFrames();
    expect(clock.timerText).toBe('00:04');
    max = 1;
    runFrames();

    expect(clock.timerText).toBe('00:00');
    expect(onLimit).toHaveBeenCalledOnce();
  });
});
