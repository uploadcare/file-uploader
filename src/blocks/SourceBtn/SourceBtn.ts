import type { ActivityType } from '../../abstract/ActivityBlock';
import { ActivityBlock } from '../../abstract/ActivityBlock';
import { UploaderBlock } from '../../abstract/UploaderBlock';
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

type BaseInitState = InstanceType<typeof UploaderBlock>['init$'];
interface SourceBtnInitState extends BaseInitState {
  iconName: string;
  'src-type': string;
}

export class SourceBtn extends UploaderBlock {
  override couldBeCtxOwner = true;
  private type: string | undefined = undefined;
  private _registeredTypes: Record<string, SourceTypeConfig> = {};

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      iconName: 'default',
      'src-type': '',
    } as SourceBtnInitState;
  }

  initTypes(): void {
    this.registerType({
      type: UploadSource.LOCAL,
      activate: () => {
        this.api.openSystemDialog();
        return false;
      },
    });
    this.registerType({
      type: UploadSource.URL,
      activity: ActivityBlock.activities.URL,
      textKey: 'from-url',
    });
    this.registerType({
      type: UploadSource.CAMERA,
      activity: ActivityBlock.activities.CAMERA,
      activate: () => {
        const supportsCapture = browserFeatures.htmlMediaCapture;

        if (supportsCapture) {
          this.api.openSystemDialog({ captureCamera: true });
        }
        return !supportsCapture;
      },
    });

    this.registerType({
      type: 'draw',
      activity: ActivityBlock.activities.DRAW,
      icon: 'edit-draw',
    });

    for (const mobileSourceType of Object.values(UploadSourceMobile)) {
      this.registerType({
        type: mobileSourceType,
        activity: ActivityBlock.activities.CAMERA,
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
      this.registerType({
        type: externalSourceType,
        activity: ActivityBlock.activities.EXTERNAL,
        activityParams: {
          externalSourceType: externalSourceType,
        },
      });
    }
  }

  override initCallback(): void {
    super.initCallback();
    this.initTypes();

    this.defineAccessor('type', (val: string) => {
      if (!val) {
        return;
      }
      this.applyType(val);
    });
  }

  registerType(typeConfig: SourceTypeConfig): void {
    this._registeredTypes[typeConfig.type] = typeConfig;
  }

  getType(type: string): SourceTypeConfig | undefined {
    return this._registeredTypes[type];
  }

  activate(): void {
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

  applyType(type: string): void {
    const configType = this._registeredTypes[type];
    if (!configType) {
      console.warn(`Unsupported source type: ${type}`);
      return;
    }
    const { textKey = type, icon = type } = configType;

    this.$['src-type'] = `${L10N_PREFIX}${textKey}`;
    this.$.iconName = icon;
    this.onclick = () => {
      this.activate();
    };
  }
}

SourceBtn.template = /* HTML */ `
  <button type="button">
    <uc-icon set="@name: iconName"></uc-icon>
    <div class="uc-txt" l10n="src-type"></div>
  </button>
`;
SourceBtn.bindAttributes({
  // @ts-expect-error symbiote types bug
  type: null,
});
