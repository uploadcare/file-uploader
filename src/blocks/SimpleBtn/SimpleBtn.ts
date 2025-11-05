import { html } from '@symbiotejs/symbiote';
import './simple-btn.css';
import { UploaderBlock } from '../../abstract/UploaderBlock';
import { asBoolean } from '../Config/validatorsType';

type BaseInitState = InstanceType<typeof UploaderBlock>['init$'];
interface SimpleBtnInitState extends BaseInitState {
  withDropZone: boolean;
  onClick: () => void;
  'button-text': string;
}

export class SimpleBtn extends UploaderBlock {
  static override styleAttrs = [...super.styleAttrs, 'uc-simple-btn'];
  override couldBeCtxOwner = true;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      withDropZone: true,
      onClick: () => {
        this.api.initFlow();
      },
      'button-text': '',
    } as SimpleBtnInitState;
  }

  override initCallback(): void {
    super.initCallback();

    this.defineAccessor('dropzone', (val: unknown) => {
      if (typeof val === 'undefined') {
        return;
      }
      this.$.withDropZone = asBoolean(val);
    });
    this.subConfigValue('multiple', (val) => {
      this.$['button-text'] = val ? 'upload-files' : 'upload-file';
    });
  }
}

SimpleBtn.template = html`
  <uc-drop-area bind="@disabled: !withDropZone">
    <button type="button" bind="onclick: onClick">
      <uc-icon name="upload"></uc-icon>
      <span l10n="button-text"></span>
      <slot></slot>
      <div class="uc-visual-drop-area" l10n="drop-files-here"></div>
    </button>
  </uc-drop-area>
`;

SimpleBtn.bindAttributes({
  // @ts-expect-error TODO: we need to update symbiote types
  dropzone: null,
});
