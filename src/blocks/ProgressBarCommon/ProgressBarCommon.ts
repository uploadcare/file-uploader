import './progress-bar-common.css';
import { html } from '@symbiotejs/symbiote';
import { UploaderBlock } from '../../abstract/UploaderBlock';

type BaseInitState = InstanceType<typeof UploaderBlock>['init$'];

interface ProgressBarCommonInitState extends BaseInitState {
  visible: boolean;
  value: number;
  '*commonProgress': number;
}

export class ProgressBarCommon extends UploaderBlock {
  private _unobserveCollectionCb?: () => void;

  constructor() {
    super();
    this.init$ = {
      ...this.init$,
      visible: false,
      value: 0,

      '*commonProgress': 0,
    } as ProgressBarCommonInitState;
  }

  override initCallback(): void {
    super.initCallback();
    this._unobserveCollectionCb = this.uploadCollection.observeProperties(() => {
      const anyUploading = this.uploadCollection.items().some((id) => {
        const item = this.uploadCollection.read(id);
        return item?.getValue('isUploading') ?? false;
      });

      this.$.visible = anyUploading;
    });

    this.sub('visible', (visible: boolean) => {
      if (visible) {
        this.setAttribute('active', '');
      } else {
        this.removeAttribute('active');
      }
    });

    this.sub('*commonProgress', (progress: number) => {
      this.$.value = progress;
    });
  }

  override destroyCallback(): void {
    super.destroyCallback();
    this._unobserveCollectionCb?.();
    this._unobserveCollectionCb = undefined;
  }
}

ProgressBarCommon.template = html` <uc-progress-bar bind="visible: visible; value: value"></uc-progress-bar> `;
