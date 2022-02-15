import { BlockComponent } from '../BlockComponent/BlockComponent.js';

const L10N_PREFIX = 'src-type-';

export class SourceBtn extends BlockComponent {
  /** @private */
  _registeredTypes = {};

  init$ = {
    iconName: 'default',
  };

  initTypes() {
    this.registerType({
      type: BlockComponent.sourceTypes.LOCAL,
      // activity: '',
      onClick: () => {
        this.openSystemDialog();
      },
    });
    this.registerType({
      type: BlockComponent.sourceTypes.URL,
      activity: BlockComponent.activities.URL,
      textKey: 'from-url',
    });
    this.registerType({
      type: BlockComponent.sourceTypes.CAMERA,
      activity: BlockComponent.activities.CAMERA,
    });
    this.registerType({
      type: 'draw',
      activity: BlockComponent.activities.DRAW,
      icon: 'edit-draw',
    });

    for (let externalSourceType of Object.values(BlockComponent.extSrcList)) {
      this.registerType({
        type: externalSourceType,
        activity: BlockComponent.activities.EXTERNAL,
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
