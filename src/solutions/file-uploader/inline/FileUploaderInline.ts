import { html } from '@symbiotejs/symbiote';
import './index.css';

import { ActivityBlock } from '../../../abstract/ActivityBlock';
import { SolutionBlock } from '../../../abstract/SolutionBlock';
import type { UploaderBlock } from '../../../abstract/UploaderBlock';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';

type BaseInitState = InstanceType<typeof SolutionBlock>['init$'];

interface FileUploaderInlineInitState extends BaseInitState {
  couldCancel: boolean;
  cancel: () => void;
}

export class FileUploaderInline extends SolutionBlock {
  static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-inline'];

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      couldCancel: false,
      '*solution': this.tagName,
      cancel: () => {
        if (this.couldHistoryBack) {
          const historyBack = this.$['*historyBack'] as (() => void) | undefined;
          historyBack?.();
          return;
        }

        if (this.couldShowList) {
          this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
        }
      },
    } as FileUploaderInlineInitState;
  }

  get couldHistoryBack(): boolean {
    const history = this.$['*history'] as string[] | undefined;
    if (!history || history.length <= 1) {
      return false;
    }
    return history[history.length - 1] !== ActivityBlock.activities.START_FROM;
  }

  get couldShowList(): boolean {
    const uploadList = this.$['*uploadList'] as unknown[] | undefined;
    return this.cfg.showEmptyList || (Array.isArray(uploadList) && uploadList.length > 0);
  }

  override initCallback(): void {
    super.initCallback();

    this.emit(InternalEventType.INIT_SOLUTION, undefined);

    const uBlock = this.ref.uBlock as UploaderBlock | undefined;
    if (!uBlock) {
      return;
    }

    this.sub('*currentActivity', (val: string | null) => {
      if (!val) {
        this.$['*currentActivity'] = uBlock.initActivity || ActivityBlock.activities.START_FROM;
      }
    });

    this.sub('*uploadList', (list: unknown) => {
      if (
        Array.isArray(list) &&
        list.length > 0 &&
        this.$['*currentActivity'] === (uBlock.initActivity || ActivityBlock.activities.START_FROM)
      ) {
        this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
      }
    });

    this.sub('*history', () => {
      this.$.couldCancel = this.couldHistoryBack || this.couldShowList;
    });
  }
}

FileUploaderInline.template = html`
  <uc-start-from>
    <uc-drop-area with-icon clickable></uc-drop-area>
    <uc-source-list role="list" wrap></uc-source-list>
    <button
      type="button"
      l10n="start-from-cancel"
      class="uc-cancel-btn uc-secondary-btn"
      bind="onclick: cancel; @hidden: !couldCancel"
    ></button>
    <uc-copyright></uc-copyright>
  </uc-start-from>
  <uc-upload-list ref="uBlock"></uc-upload-list>
  <uc-camera-source></uc-camera-source>
  <uc-url-source></uc-url-source>
  <uc-external-source></uc-external-source>
  <uc-cloud-image-editor-activity></uc-cloud-image-editor-activity>
`;
