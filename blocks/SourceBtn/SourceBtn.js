import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';

const L10N_PREFIX = 'src-type-';

export class SourceBtn extends UploaderBlock {
  couldBeCtxOwner = true;
  /** @private */
  _registeredTypes = {};

  init$ = {
    ...this.init$,
    iconName: 'default',
  };

  initTypes() {
    this.registerType({
      type: UploaderBlock.sourceTypes.LOCAL,
      onClick: () => {
        this.openSystemDialog();
      },
    });
    this.registerType({
      type: UploaderBlock.sourceTypes.URL,
      activity: ActivityBlock.activities.URL,
      textKey: 'from-url',
    });
    this.registerType({
      type: UploaderBlock.sourceTypes.CAMERA,
      activity: ActivityBlock.activities.CAMERA,
      onClick: () => {
        let el = document.createElement('input');
        var supportsCapture = el.capture !== undefined;
        if (supportsCapture) {
          this.openSystemDialog({ captureCamera: true });
        }
        return !supportsCapture;
      },
    });
    this.registerType({
      type: 'draw',
      activity: ActivityBlock.activities.DRAW,
      icon: 'edit-draw',
    });

    for (let externalSourceType of Object.values(UploaderBlock.extSrcList)) {
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

    this.setAttribute('role', 'button');
    this.defineAccessor('type', (val) => {
      if (!val) {
        return;
      }
      this.applyType(val);
    });
  }

  registerType(typeConfig) {
    this._registeredTypes[typeConfig.type] = typeConfig;
  }

  getType(type) {
    return this._registeredTypes[type];
  }

  applyType(type) {
    const configType = this._registeredTypes[type];
    if (!configType) {
      console.warn('Unsupported source type: ' + type);
      return;
    }
    const { textKey = type, icon = type, activity, onClick, activityParams = {} } = configType;

    this.applyL10nKey('src-type', `${L10N_PREFIX}${textKey}`);
    this.$.iconName = icon;
    this.onclick = (e) => {
      const showActivity = onClick ? onClick(e) : !!activity;
      showActivity &&
        this.set$({
          '*currentActivityParams': activityParams,
          '*currentActivity': activity,
        });
    };
  }
}
SourceBtn.template = /* HTML */ `
  <lr-icon set="@name: iconName"></lr-icon>
  <div class="txt" l10n="src-type"></div>
`;
SourceBtn.bindAttributes({
  type: null,
});
