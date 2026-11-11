import type { CameraLifetime, CameraSessionHost } from '../CameraSession';
import { stopTracks } from './tracks';

/**
 * Opens the microphone again with changed settings, for its track to be swapped in; the camera keeps running. A live
 * track can't be changed instead: Chromium ignores processing changes on one and refuses stereo. The new microphone
 * opens before the old one stops, so a failure keeps the sound that was working.
 */
export class MicrophoneSwap {
  /** Counts the swaps, so a slower, older one can tell it was superseded. */
  private _swaps = 0;

  public constructor(
    private readonly _lifetime: CameraLifetime,
    private readonly _report: CameraSessionHost['report'],
  ) {}

  /**
   * Opens a microphone with `audio` and resolves with its track, for the caller to swap in. Only the latest swap gets
   * one: a superseded one, or one that `isCurrent` no longer wants, stops its tracks and resolves null, as does one
   * that failed to open.
   */
  public async open(audio: MediaTrackConstraints, isCurrent: () => boolean): Promise<MediaStreamTrack | null> {
    const swap = ++this._swaps;
    const adoption = this._lifetime.adoptionSignal();
    let next: MediaStream;
    try {
      next = await this._lifetime.whileAdopted(navigator.mediaDevices.getUserMedia({ audio }), stopTracks);
    } catch (error) {
      // `getUserMedia` names a microphone that fails to start `AbortError` too, so ask the lifetime.
      if (adoption.aborted) throw error;
      this._report(
        'warn',
        'Failed to apply the microphone settings, keeping the current ones',
        error,
        'camera capturing. Failed to reopen the microphone',
      );
      return null;
    }
    const [track] = next.getAudioTracks();
    if (swap !== this._swaps || !isCurrent() || !track) {
      stopTracks(next);
      return null;
    }
    return track;
  }
}
