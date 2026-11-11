import { signalState } from '../../../abstract/di/signalState';

export function formatTime(time: number): string {
  const minutes = Math.floor(time / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** What the controls render of the clock. */
export type ClockView = { readonly timerText: string; readonly progress: number | null };

/** Drives the recording timer and the playback timeline, one animation frame at a time. */
export class RecordingClock implements ClockView {
  /** The time shown in the timer. */
  @signalState() public timerText = '00:00';
  /** How far the clip under review has played, 0 to 1; null until it first plays. */
  @signalState() public progress: number | null = null;

  private _frame: number | null = null;
  private _startTime = 0;

  /**
   * Shows the recording time: the time left when `maxSeconds()` gives a limit, else the time so far. `onLimit` runs
   * when the time is up.
   */
  public startTimer(maxSeconds: () => number | undefined, onLimit: () => void): void {
    this.stop();
    this._startTime = performance.now();
    const tick = (): void => {
      const elapsed = Math.floor((performance.now() - this._startTime) / 1000);
      const max = maxSeconds();
      if (typeof max === 'number' && max > 0) {
        const remaining = max - elapsed;
        this._show(remaining);
        if (remaining <= 0) {
          onLimit();
          return;
        }
      } else {
        this._show(elapsed);
      }
      this._frame = requestAnimationFrame(tick);
    };
    tick();
  }

  /** Follows the clip's playback in the timeline and the timer; `sample()` gives null once the clip is gone. */
  public startTimeline(sample: () => { currentTime: number; duration: number } | null): void {
    this.stop();
    const tick = (): void => {
      const playback = sample();
      if (!playback) return;
      this.progress = playback.currentTime / playback.duration;
      this._show(playback.currentTime);
      this._frame = requestAnimationFrame(tick);
    };
    tick();
  }

  /** Stops whichever loop is running; starting one stops the other, so only one ever writes the timer. */
  public stop(): void {
    if (this._frame) cancelAnimationFrame(this._frame);
    this._frame = null;
  }

  /** Writes the timer only when the shown text changes, so a frame within the same second re-renders nothing. */
  private _show(time: number): void {
    const text = formatTime(time);
    if (text !== this.timerText) this.timerText = text;
  }
}
