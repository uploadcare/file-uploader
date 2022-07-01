import { UploaderBlock } from '../../abstract/UploaderBlock.js';

export class ProgressBarCommon extends UploaderBlock {
  init$ = {
    ...this.init$,
    visible: false,
    unknown: false,
    value: 0,

    '*commonProgress': 0,
  };

  initCallback() {
    super.initCallback();
    this.uploadCollection.observe(() => {
      let anyUploading = this.uploadCollection.items().some((id) => {
        let item = this.uploadCollection.read(id);
        return item.getValue('isUploading');
      });

      this.$.visible = anyUploading;
    });

    this.sub('visible', (visible) => {
      if (visible) {
        this.setAttribute('active', '');
      } else {
        this.removeAttribute('active');
      }
    });

    this.sub('*commonProgress', (progress) => {
      this.$.value = progress;
    });
  }
}

ProgressBarCommon.template = /*html*/ `
<lr-progress-bar set="visible: visible; unknown: unknown; value: value"></lr-progress-bar>
`;
