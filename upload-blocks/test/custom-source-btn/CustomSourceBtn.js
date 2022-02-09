// @ts-nocheck
const SourceBtnClass = window.customElements.get('uc-source-btn');

class CustomSourceBtn extends SourceBtnClass {
  initTypes() {
    super.initTypes();

    this.registerType({
      ...this.getType('local'),
      icon: 'facebook',
      textKey: 'custom',
    });

    this.registerType({
      type: 'custom',
      activity: 'url',
      icon: 'facebook',
      textKey: 'custom',
    });
  }
}

CustomSourceBtn.reg('custom-source-btn');
