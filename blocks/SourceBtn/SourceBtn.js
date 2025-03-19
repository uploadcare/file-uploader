// @ts-check
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { browserFeatures } from '../../utils/browser-info.js';
import { CameraSourceTypes } from '../CameraSource/constants.js';
import { ExternalUploadSource, UploadSource, UploadSourceMobile } from '../utils/UploadSource.js';

const L10N_PREFIX = 'src-type-';

/**
 * @typedef {{
 *   type: string;
 *   activity?: string;
 *   textKey?: string;
 *   icon?: string;
 *   activate?: () => boolean;
 *   activityParams?: Record<string, unknown>;
 * }} TConfig
 */

export class SourceBtn extends UploaderBlock {
  couldBeCtxOwner = true;
  /** @type {string | undefined} */
  type = undefined;
  /**
   * @private
   * @type {Record<string, TConfig>}
   */
  _registeredTypes = {};

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      iconName: 'default',
      'src-type': '',
    };
  }

  initTypes() {
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

    for (let mobileSourceType of Object.values(UploadSourceMobile)) {
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

    for (let externalSourceType of Object.values(ExternalUploadSource)) {
      this.registerType({
        type: externalSourceType,
        activity: ActivityBlock.activities.EXTERNAL,
        activityParams: {
          externalSourceType: externalSourceType,
        },
      });
    }
  }

  initCallback() {
    super.initCallback();
    this.initTypes();

    this.defineAccessor(
      'type',
      /** @param {string} val */
      (val) => {
        if (!val) {
          return;
        }
        this.applyType(val);
      },
    );
  }

  /** @param {TConfig} typeConfig */
  registerType(typeConfig) {
    this._registeredTypes[typeConfig.type] = typeConfig;
  }

  /** @param {string} type */
  getType(type) {
    return this._registeredTypes[type];
  }

  activate() {
    if (!this.type) {
      return;
    }
    const configType = this._registeredTypes[this.type];
    const { activity, activate, activityParams = {} } = configType;
    const showActivity = activate ? activate() : !!activity;

    if (showActivity) {
      this.modalManager.open(/** @type {string} */ (activity));

      this.set$({
        '*currentActivityParams': activityParams,
        '*currentActivity': activity,
      });
    }
  }

  /** @param {string} type */
  applyType(type) {
    const configType = this._registeredTypes[type];
    if (!configType) {
      console.warn('Unsupported source type: ' + type);
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
