import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { ChildBlock } from '../../lit/ChildBlock';
import { CameraActionEvent } from './CameraActionEvent';
import type { CameraView } from './cameraView';

/** The camera's picture: the video, or the message asking for or explaining access. */
export class CameraPreview extends ChildBlock {
  @property({ attribute: false })
  public view: Pick<CameraView, 'videoHidden' | 'messageHidden' | 'message'> | null = null;

  /** Mirrors the video, as `cameraMirror` asks. */
  @property({ type: Boolean, attribute: false })
  public mirror = false;

  @property({ type: Boolean, attribute: false })
  public requestButtonHidden = true;

  private readonly _videoRef = createRef<HTMLVideoElement>();

  /** The video element; the container feeds it the stream and the recorded clip. */
  public get video(): HTMLVideoElement | undefined {
    return this._videoRef.value;
  }

  private readonly _emit = (action: CameraActionEvent['action']) => this.dispatchEvent(new CameraActionEvent(action));

  public override render() {
    const view = this.view;
    return html`
      <div class="uc-content">
        <video
          muted
          autoplay
          playsinline
          style=${styleMap({ transform: this.mirror ? 'scaleX(-1)' : null })}
          ?hidden=${view?.videoHidden ?? true}
          @loadeddata=${() => this._emit({ type: 'video-frame', ready: true })}
          @emptied=${() => this._emit({ type: 'video-frame', ready: false })}
          ${ref(this._videoRef)}
        ></video>
        <div class="uc-message-box" ?hidden=${view?.messageHidden ?? true}>
          <span>${view ? this.l10n<string>(view.message) : ''}</span>
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
