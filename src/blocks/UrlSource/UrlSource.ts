import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { ACTIVITY_TYPES, type ActivityType } from '../../lit/activity-constants';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import { UploadSource } from '../../utils/UploadSource';
import { InternalEventType } from '../UploadCtxProvider/EventEmitter';
import './url-source.css';

interface UrlSourceState {
  importDisabled: boolean;
}

export class UrlSource extends LitUploaderBlock {
  public override couldBeCtxOwner = true;
  public override activityType: ActivityType = ACTIVITY_TYPES.URL;

  @state()
  private _formState: UrlSourceState = {
    importDisabled: true,
  };

  public override initCallback(): void {
    super.initCallback();
    this.registerActivity(this.activityType ?? '', {
      onActivate: () => {
        const input = this._inputRef.value;
        if (input) {
          input.value = '';
          input.focus();
        }
        this._formState = { importDisabled: true };
      },
    });
  }

  private _inputRef = createRef<HTMLInputElement>();

  private _handleInput = (event: Event) => {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this._formState = { importDisabled: !value };
  };

  private _handleUpload = (event: Event) => {
    event.preventDefault();
    this.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'upload-from-url',
          node: this.tagName,
        },
      },
    });
    const input = this._inputRef.value;
    const url = input?.value?.trim();
    if (!url) {
      return;
    }
    this.api.addFileFromUrl(url, { source: UploadSource.URL });
    this.modalManager?.open(ACTIVITY_TYPES.UPLOAD_LIST);
    this.$['*currentActivity'] = ACTIVITY_TYPES.UPLOAD_LIST;
  };

  public override render() {
    return html`
      <uc-activity-header>
        <button type="button" class="uc-mini-btn" @click=${this.historyBack} title=${this.l10n('back')} aria-label=${this.l10n('back')}>
          <uc-icon name="back"></uc-icon>
        </button>
        <div>
          <uc-icon name="url"></uc-icon>
          <span>${this.l10n('caption-from-url')}</span>
        </div>
        <button
          type="button"
          class="uc-mini-btn uc-close-btn"
          @click=${this.$['*closeModal']}
          title=${this.l10n('a11y-activity-header-button-close')}
          aria-label=${this.l10n('a11y-activity-header-button-close')}
        >
          <uc-icon name="close"></uc-icon>
        </button>
      </uc-activity-header>
      <form class="uc-content" @submit=${this._handleUpload}>
        <label>
          <input
            ${ref(this._inputRef)}
            placeholder="https://"
            class="uc-url-input"
            type="text"
            @input=${this._handleInput}
          />
        </label>
          <button
            type="submit"
            class="uc-url-upload-btn uc-primary-btn"
            ?disabled=${this._formState.importDisabled}
            >${this.l10n('upload-url')}</button>
      </form>
    `;
  }
}
