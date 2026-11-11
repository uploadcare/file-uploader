import type { CameraLifetime, CameraSessionHost } from '../CameraSession';
import { stopTracks } from './tracks';

/** What a swap checks once its microphone opened: still for the stream it was asked for, and no recording begun. */
export type SwapGate = { isCurrent: () => boolean; isRecording: () => boolean };

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
   * Opens a microphone with `audio` and hands its track to `commit`, right after the checks with no await between.
   * Only the latest swap commits: a superseded one, or one whose stream was replaced, stops its tracks (`stale`). One
   * that lands during a recording stops them too, since swapping then would break the recording (`deferred`).
   */
  public async open(
    audio: MediaTrackConstraints,
    gate: SwapGate,
    commit: (track: MediaStreamTrack) => void,
  ): Promise<'swapped' | 'stale' | 'deferred' | 'failed'> {
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
      return 'failed';
    }
    const [track] = next.getAudioTracks();
    if (swap !== this._swaps || !gate.isCurrent() || !track) {
      stopTracks(next);
      return 'stale';
    }
    if (gate.isRecording()) {
      stopTracks(next);
      return 'deferred';
    }
    commit(track);
    return 'swapped';
  }
}
