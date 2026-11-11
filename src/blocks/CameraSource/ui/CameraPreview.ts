import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { ChildBlock } from '../../../lit/ChildBlock';
import { cssomStyleMap } from '../../../lit/cssom-style-map';
import { CameraActionEvent } from './CameraActionEvent';
import type { CameraView } from './cameraView';
import './camera-preview.css';

/** The camera's picture: the video, or the message asking for or explaining access. */
export class CameraPreview extends ChildBlock {
  @property({ attribute: false })
  public view: Pick<CameraView, 'videoHidden' | 'messageHidden' | 'message'> | null = null;

  /** Mirrors the video, as `cameraMirror` asks. */
  @property({ type: Boolean, attribute: false })
  public mirror = false;

  /**
   * The capture's width / height, which the preview is cropped to from the center, as photos and recordings are; null
   * for the camera's own shape.
   */
  @property({ attribute: false })
  public aspectRatio: number | null = null;

  @property({ type: Boolean, attribute: false })
  public requestButtonHidden = true;

  private readonly _videoRef = createRef<HTMLVideoElement>();

  private readonly _emit = (action: CameraActionEvent['action']) => this.dispatchEvent(new CameraActionEvent(action));

  /** Fires once the first frame is in and again whenever the camera's shape changes, as on turning a phone. */
  private readonly _handleResize = (event: Event): void => {
    const { videoWidth: width, videoHeight: height } = event.currentTarget as HTMLVideoElement;
    if (width && height) this._emit({ type: 'preview-resize', width, height });
  };

  /** Lends the camera the `<video>` to show its stream and clips in. */
  private _lendVideo(): void {
    const video = this._videoRef.value;
    if (video) this._emit({ type: 'video-element', video });
  }

  // The `<video>` exists from the first render on and is never replaced, so the camera shows its stream in it from here.
  public override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    this._lendVideo();
  }

  // A DOM move releases the camera, which lets go of the `<video>`, and re-adopts it without a new first render.
  protected override controllerReady(): void {
    this._lendVideo();
  }

  public override render() {
    const view = this.view;
    return html`
      <div class="uc-content">
        <video
          muted
          autoplay
          playsinline
          class=${classMap({ 'uc-cropped': this.aspectRatio !== null })}
          style=${cssomStyleMap({
            transform: this.mirror ? 'scaleX(-1)' : null,
            aspectRatio: this.aspectRatio === null ? null : String(this.aspectRatio),
          })}
          @resize=${this._handleResize}
          ?hidden=${view?.videoHidden ?? true}
          @loadeddata=${() => this._emit({ type: 'video-frame', ready: true })}
          @emptied=${() => this._emit({ type: 'video-frame', ready: false })}
          ${ref(this._videoRef)}
        ></video>
        <div class="uc-message-box" ?hidden=${view?.messageHidden ?? true}>
          <span>${view ? this.l10n(view.message) : ''}</span>
          <button
            type="button"
            @click=${() => this._emit({ type: 'request-access' })}
            ?hidden=${this.requestButtonHidden}
          >
            ${this.l10n('camera-permissions-request')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-camera-preview': CameraPreview;
  }
}
