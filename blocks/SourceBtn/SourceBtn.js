import { Block } from '../../abstract/Block.js';

const L10N_PREFIX = 'src-type-';

export class SourceBtn extends Block {
  /** @private */
  _registeredTypes = {};

  init$ = {
    iconName: 'default',
  };

  initTypes() {
    this.registerType({
      type: Block.sourceTypes.LOCAL,
      // activity: '',
      onClick: () => {
        this.openSystemDialog();
      },
    });
    this.registerType({
      type: Block.sourceTypes.URL,
      activity: Block.activities.URL,
      textKey: 'from-url',
    });
    this.registerType({
      type: Block.sourceTypes.CAMERA,
      activity: Block.activities.CAMERA,
    });
    this.registerType({
      type: 'draw',
      activity: Block.activities.DRAW,
      icon: 'edit-draw',
    });

    for (let externalSourceType of Object.values(Block.extSrcList)) {
      this.registerType({
        type: externalSourceType,
        activity: Block.activities.EXTERNAL,
        activityParams: {
          externalSourceType: externalSourceType,
        },
      });
    }
  }

  initCallback() {
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
      activity &&
        this.set$({
          '*currentActivityParams': activityParams,
          '*currentActivity': activity,
        });
      onClick && onClick(e);
    };
  }
}
SourceBtn.template = /*html*/ `
<uc-icon set="@name: iconName"></uc-icon>
<div class="txt" l10n="src-type"></div>
`;
SourceBtn.bindAttributes({
  type: null,
});
