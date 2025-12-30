import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { type ActivityType, LitActivityBlock } from '../../lit/LitActivityBlock';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import { browserFeatures } from '../../utils/browser-info';
import { ExternalUploadSource, UploadSource, UploadSourceMobile } from '../../utils/UploadSource';
import { CameraSourceTypes } from '../CameraSource/constants';
import './source-btn.css';

const L10N_PREFIX = 'src-type-';

type SourceTypeConfig = {
  type: string;
  activity?: ActivityType | null;
  textKey?: string;
  icon?: string;
  activate?: () => boolean;
  activityParams?: Record<string, unknown>;
};

export class SourceBtn extends LitUploaderBlock {
  public override couldBeCtxOwner = true;
  private _registeredTypes: Record<string, SourceTypeConfig> = {};

  @property({ type: String })
  public type?: string;

  @state()
  private _iconName = 'default';

  @state()
  private _srcTypeKey = '';

  private _initTypes(): void {
    this._registerType({
      type: UploadSource.LOCAL,
      activate: () => {
        this.api.openSystemDialog();
        return false;
      },
    });
    this._registerType({
      type: UploadSource.URL,
      activity: LitActivityBlock.activities.URL,
      textKey: 'from-url',
    });
    this._registerType({
      type: UploadSource.CAMERA,
      activity: LitActivityBlock.activities.CAMERA,
      activate: () => {
        const supportsCapture = browserFeatures.htmlMediaCapture;

        if (supportsCapture) {
          this.api.openSystemDialog({ captureCamera: true });
        }
        return !supportsCapture;
      },
    });

    this._registerType({
      type: 'draw',
      activity: LitActivityBlock.activities.DRAW,
      icon: 'edit-draw',
    });

    for (const mobileSourceType of Object.values(UploadSourceMobile)) {
      this._registerType({
        type: mobileSourceType,
        activity: LitActivityBlock.activities.CAMERA,
        activate: () => {
          const supportsCapture = browserFeatures.htmlMediaCapture;
          if (supportsCapture) {
            this.api.openSystemDialog({
              captureCamera: true,
              modeCamera:
                mobileSourceType === 'mobile-photo-camera' ? CameraSourceTypes.PHOTO : CameraSourceTypes.VIDEO,
            });
          }
          return !supportsCapture;
        },
      });
    }

    for (const externalSourceType of Object.values(ExternalUploadSource)) {
      this._registerType({
        type: externalSourceType,
        activity: LitActivityBlock.activities.EXTERNAL,
        activityParams: {
          externalSourceType: externalSourceType,
        },
      });
    }
  }

  public override initCallback(): void {
    super.initCallback();
    this._initTypes();

    if (this.type) {
      this._applyType(this.type);
    }
  }

  private _registerType(typeConfig: SourceTypeConfig): void {
    this._registeredTypes[typeConfig.type] = typeConfig;
  }

  public activate(): void {
    if (!this.type) {
      return;
    }
    const configType = this._registeredTypes[this.type];
    if (!configType) {
      return;
    }
    const { activity, activate, activityParams = {} } = configType;
    const showActivity = activate ? activate() : !!activity;

    if (showActivity) {
      if (activity) {
        this.modalManager?.open(activity);

        this.set$({
          '*currentActivityParams': activityParams,
          '*currentActivity': activity,
        });
      }
    }
  }

  private _applyType(type: string): void {
    const configType = this._registeredTypes[type];
    if (!configType) {
      console.warn(`Unsupported source type: ${type}`);
      return;
    }
    const { textKey = type, icon = type } = configType;

    this._srcTypeKey = `${L10N_PREFIX}${textKey}`;
    this._iconName = icon;
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('type')) {
      if (this.type) {
        this._applyType(this.type);
      } else {
        this._srcTypeKey = '';
        this._iconName = 'default';
      }
    }
  }

  public override render() {
    return html`
    <button type="button" @click=${this.activate}>
    <uc-icon name=${this._iconName}></uc-icon>
    <div class="uc-txt">${this.l10n(this._srcTypeKey)}</div>
  </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-source-btn': SourceBtn;
  }
}
