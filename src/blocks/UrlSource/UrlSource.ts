import type { ActivityType } from '../../abstract/ActivityBlock';
import { ActivityBlock } from '../../abstract/ActivityBlock';
import { UploaderBlock } from '../../abstract/UploaderBlock';
import { UploadSource } from '../../utils/UploadSource';
import { EventType } from '../UploadCtxProvider/EventEmitter';
import './url-source.css';

type BaseInitState = InstanceType<typeof UploaderBlock>['init$'];

interface UrlSourceInitState extends BaseInitState {
  importDisabled: boolean;
  onUpload: (event: Event) => void;
  onCancel: () => void;
  onInput: (event: Event) => void;
}

export class UrlSource extends UploaderBlock {
  override couldBeCtxOwner = true;
  override activityType: ActivityType = ActivityBlock.activities.URL;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      importDisabled: true,
      onUpload: (event: Event) => {
        event.preventDefault();
        this.emit(EventType.ACTION_EVENT, {
          metadata: {
            event: 'upload-from-url',
            node: this.tagName,
          },
        });

        const url = this.ref.input['value'] as string;
        this.api.addFileFromUrl(url, { source: UploadSource.URL });
        this.modalManager?.open(ActivityBlock.activities.UPLOAD_LIST);
        this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
      },
      onCancel: () => {
        this.historyBack();
      },
      onInput: (event: Event) => {
        const value = (event.target as HTMLInputElement | null)?.value ?? '';
        this.set$({ importDisabled: !value });
      },
    } as UrlSourceInitState;
  }

  override initCallback(): void {
    super.initCallback();
    this.registerActivity(this.activityType ?? '', {
      onActivate: () => {
        const input = this.ref.input as HTMLInputElement;
        input.value = '';
        input.focus();
      },
    });
  }
}

UrlSource.template = /* HTML */ `
  <uc-activity-header>
    <button type="button" class="uc-mini-btn" set="onclick: *historyBack" l10n="@title:back;@aria-label:back">
      <uc-icon name="back"></uc-icon>
    </button>
    <div>
      <uc-icon name="url"></uc-icon>
      <span l10n="caption-from-url"></span>
    </div>
    <button
      type="button"
      class="uc-mini-btn uc-close-btn"
      set="onclick: *closeModal"
      l10n="@title:a11y-activity-header-button-close;@aria-label:a11y-activity-header-button-close"
    >
      <uc-icon name="close"></uc-icon>
    </button>
  </uc-activity-header>
  <form class="uc-content">
    <label>
      <input placeholder="https://" class="uc-url-input" type="text" ref="input" set="oninput: onInput" />
    </label>
    <button
      type="submit"
      class="uc-url-upload-btn uc-primary-btn"
      set="onclick: onUpload; @disabled: importDisabled"
      l10n="upload-url"
    ></button>
  </form>
`;
