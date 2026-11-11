import { recordingFileType } from '../../../abstract/camera/videoFormat';
import { signalState } from '../../../abstract/di/signalState';
import { createCameraFile, guessExtensionByMime } from './cameraFile';
import type { Clip } from './VideoRecording';

/** The recorded clip under review: its object URL for the preview, its play/pause icon, and the file it is sent as. */
export class ClipReview {
  @signalState() public timelineIcon: 'play' | 'pause' = 'play';
  @signalState() private _mirrored = false;

  private _clip: Clip | null = null;
  /** Revoked when replaced or closed. */
  private _url: string | null = null;

  /** The clip has its mirroring baked in, so the preview must not mirror it again. */
  public get mirrored(): boolean {
    return this._mirrored;
  }

  /** Revokes the previous clip's URL; returns the new one's. */
  public show(clip: Clip): string {
    this._revoke();
    this._clip = clip;
    this._mirrored = clip.mirrored;
    this._url = URL.createObjectURL(clip.blob);
    return this._url;
  }

  public playing(on: boolean): void {
    this.timelineIcon = on ? 'pause' : 'play';
  }

  /** The clip as a file to upload, named and dated now; the clip is let go. */
  public take(): File | null {
    const clip = this._clip;
    this._clip = null;
    this._mirrored = false;
    if (!clip) return null;
    return createCameraFile('video', guessExtensionByMime(clip.mimeType), recordingFileType(clip.mimeType), clip.blob);
  }

  public close(): void {
    this._revoke();
    this._clip = null;
    this._mirrored = false;
  }

  public resetIcon(): void {
    this.timelineIcon = 'play';
  }

  private _revoke(): void {
    if (this._url) {
      URL.revokeObjectURL(this._url);
      this._url = null;
    }
  }
}
