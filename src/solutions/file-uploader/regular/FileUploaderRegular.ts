import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { LocaleController } from '../../../abstract/controllers/LocaleController';
import { RouterController } from '../../../abstract/controllers/RouterController';
import type { ControllerContainer } from '../../../abstract/di/ControllerContainer';
import { inject } from '../../../abstract/di/inject';
import { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import { SolutionChildBlock } from '../../../lit/SolutionChildBlock';
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
import '../../../blocks/DynamicBtn/DynamicBtn';
import '../../../blocks/PluginActivityRenderer/PluginActivityRenderer';

export class FileUploaderRegular extends SolutionChildBlock {
  public static override lazyPlugins = fileUploaderLazyPlugins;

  @inject(RouterController) private readonly _router!: RouterController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;

  // Type-only: feeds the JSX attribute typing (`ReflectAttributes` in
  // `types/jsx.d.ts` reads `attributesMeta`). Kept on the ChildBlock port —
  // the documented attribute surface, same as the merged `Config` port.
  public declare attributesMeta: {
    headless?: boolean;
    'dynamic-button'?: boolean;
    'ctx-name': string;
  };
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-regular'];

  @property({ type: Boolean })
  public headless = false;

  @property({ attribute: 'dynamic-button', type: Boolean })
  public dynamicButton = false;

  protected override controllerReady(container: ControllerContainer): void {
    super.controllerReady(container);

    // Regular renders every activity inside a `<uc-modal>`, so all navigation
    // targets the foreground (modal) slot.
    this._router.navigationStrategy = () => 'foreground';

    this._telemetry.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });
  }

  protected override subscriptionsFor(container: ControllerContainer) {
    // The cancel button's label is rendered through `this.l10n(...)` — re-render
    // when the dictionary loads or the locale switches (same convention as every
    // other l10n-rendering ChildBlock, e.g. SimpleBtn/UploadList).
    return [(listener: () => void) => container.get(LocaleController).subscribe(listener)];
  }

  /**
   * Exposes whether the dynamic button is active for non-Lit classes that can't use context
   */
  public get isDynamicButtonActive(): boolean {
    return this.dynamicButton;
  }

  private _renderDynamicButton() {
    return html`
      <uc-dynamic-btn></uc-dynamic-btn>
    `;
  }

  private _renderStaticButton() {
    return html`
      <uc-simple-btn></uc-simple-btn>
    `;
  }

  private _renderButton() {
    if (this.headless) return null;
    if (this.dynamicButton) return this._renderDynamicButton();
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
      <button type="button" class="uc-secondary-btn" @click=${() => this._router.traverse('onCancel')}>${this.l10n('start-from-cancel')}</button>
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
