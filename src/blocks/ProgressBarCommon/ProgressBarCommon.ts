import { html, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import './progress-bar-common.css';

type BaseInitState = InstanceType<typeof LitUploaderBlock>['init$'];

interface ProgressBarCommonInitState extends BaseInitState {
  '*commonProgress': number;
}

export class ProgressBarCommon extends LitUploaderBlock {
  private _unobserveCollectionCb?: () => void;

  @state()
  protected visible = false;

  @state()
  protected value = 0;

  constructor() {
    super();
    this.init$ = {
      ...this.init$,
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

      this.visible = anyUploading;
    });

    this.sub('*commonProgress', (progress: number) => {
      this.value = progress;
    });
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('visible' as keyof ProgressBarCommon)) {
      if (this.visible) {
        this.setAttribute('active', '');
      } else {
        this.removeAttribute('active');
      }
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unobserveCollectionCb?.();
    this._unobserveCollectionCb = undefined;
  }

  override render() {
    return html` <uc-progress-bar .value=${this.value} .visible=${this.visible}></uc-progress-bar> `;
  }
}
