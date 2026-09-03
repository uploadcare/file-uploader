import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { RouterController } from '../../../abstract/controllers/RouterController';
import type { ControllerContainer } from '../../../abstract/di/ControllerContainer';
import { inject } from '../../../abstract/di/inject';
import { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import { SolutionChildBlock } from '../../../lit/SolutionChildBlock';
import './index.css';
import { renderModalSourcePicker } from '../layout-fragments.js';
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

  ${renderModalSourcePicker({
    onCancel: () => this._router.traverse('onCancel'),
    cancelLabel: this.l10n('start-from-cancel'),
    copyright: true,
  })}

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
