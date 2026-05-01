import { ContextProvider } from '@lit/context';
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import { LitSolutionBlock } from '../../../lit/LitSolutionBlock';
import './index.css';
import { fileUploaderLazyPlugins } from '../lazyPlugins.js';

import '../../../blocks/Modal/Modal';
import '../../../blocks/StartFrom/StartFrom';
import '../../../blocks/DropArea/DropArea';
import '../../../blocks/SourceList/SourceList';
import '../../../blocks/Copyright/Copyright';
import '../../../blocks/UploadList/UploadList';
import '../../../blocks/CloudImageEditorActivity/CloudImageEditorActivity';
import '../../../blocks/SimpleBtn/SimpleBtn';
import '../../../blocks/SmartBtn/SmartBtn';
import '../../../blocks/PluginActivityRenderer/PluginActivityRenderer';

import { smartBtnActiveContext } from '../../../blocks/SmartBtn/smart-btn-context';

type BaseInitState = InstanceType<typeof LitSolutionBlock>['init$'];
interface FileUploaderRegularInitState extends BaseInitState {}

export class FileUploaderRegular extends LitSolutionBlock {
  public static override lazyPlugins = fileUploaderLazyPlugins;

  public declare attributesMeta: {
    headless?: boolean;
    dynamic?: boolean;
    'ctx-name': string;
  };
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-regular'];

  private _smartBtnActiveProvider = new ContextProvider(this, {
    context: smartBtnActiveContext,
    initialValue: false,
  });

  @property({ type: Boolean })
  public headless = false;

  @property({ type: Boolean })
  public dynamic = false;

  public constructor() {
    super();

    this.init$ = {
      ...this.init$,
    } as FileUploaderRegularInitState;
  }

  public override initCallback(): void {
    super.initCallback();

    this.telemetryManager.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });
  }

  protected override willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('dynamic')) {
      this._smartBtnActiveProvider.setValue(this.dynamic);
    }
  }

  /**
   * Exposes whether SmartBtn is active for non-Lit classes that can't use context
   */
  public get isSmartBtnActive(): boolean {
    return this.dynamic;
  }

  private _renderDynamicButton() {
    return html`
      <uc-smart-btn></uc-smart-btn>
    `;
  }

  private _renderStaticButton() {
    return html`
      <uc-simple-btn></uc-simple-btn>
    `;
  }

  private _renderButton() {
    if (this.headless) return null;
    if (this.dynamic) return this._renderDynamicButton();
    return this._renderStaticButton();
  }

  public override render() {
    return html`
    ${super.render()}

    ${this._renderButton()}

  <uc-modal id="start-from" strokes block-body-scrolling>
    <uc-start-from>
      <uc-drop-area with-icon clickable></uc-drop-area>
      <uc-source-list role="list" wrap></uc-source-list>
      <button type="button" class="uc-secondary-btn" @click=${this.$['*historyBack']}>${this.l10n('start-from-cancel')}</button>
      <uc-copyright></uc-copyright>
    </uc-start-from>
  </uc-modal>

  <uc-modal id="upload-list" strokes block-body-scrolling>
    <uc-upload-list></uc-upload-list>
  </uc-modal>

  <uc-plugin-activity-renderer mode="modal"></uc-plugin-activity-renderer>
`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-file-uploader-regular': FileUploaderRegular;
  }
}
