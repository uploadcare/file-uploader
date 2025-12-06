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
  private _visible = false;

  @state()
  private _value = 0;

  public constructor() {
    super();
    this.init$ = {
      ...this.init$,
      '*commonProgress': 0,
    } as ProgressBarCommonInitState;
  }

  public override initCallback(): void {
    super.initCallback();
    this._unobserveCollectionCb = this.uploadCollection.observeProperties(() => {
      const anyUploading = this.uploadCollection.items().some((id) => {
        const item = this.uploadCollection.read(id);
        return item?.getValue('isUploading') ?? false;
      });

      this._visible = anyUploading;
    });

    this.sub('*commonProgress', (progress: number) => {
      this._value = progress;
    });
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('visible' as keyof ProgressBarCommon)) {
      if (this._visible) {
        this.setAttribute('active', '');
      } else {
        this.removeAttribute('active');
      }
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unobserveCollectionCb?.();
    this._unobserveCollectionCb = undefined;
  }

  public override render() {
    return html` <uc-progress-bar .value=${this._value} .visible=${this._visible}></uc-progress-bar> `;
  }
}
