// @ts-check
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import 'tui-color-picker';
import 'tui-image-editor';
// import { ImageEditor } from 'tui-image-editor'

var blackTheme = {
  'common.bi.image': 'https://uicdn.toast.com/toastui/img/tui-image-editor-bi.png',
  'common.bisize.width': '251px',
  'common.bisize.height': '21px',
  'common.backgroundImage': 'none',
  'common.backgroundColor': '#1e1e1e',
  'common.border': '0px',

  // header
  // 'header.backgroundImage': 'none',
  'header.backgroundColor': 'transparent',
  'header.border': '0px',
  'header.display': 'none',

  // load button
  'loadButton.backgroundColor': '#fff',
  'loadButton.border': '1px solid #ddd',
  'loadButton.color': '#222',
  'loadButton.fontFamily': "'Noto Sans', sans-serif",
  'loadButton.fontSize': '12px',

  // download button
  'downloadButton.backgroundColor': '#fdba3b',
  'downloadButton.border': '1px solid #fdba3b',
  'downloadButton.color': '#fff',
  'downloadButton.fontFamily': "'Noto Sans', sans-serif",
  'downloadButton.fontSize': '12px',

  // main icons
  'menu.normalIcon.color': '#8a8a8a',
  'menu.activeIcon.color': '#555555',
  'menu.disabledIcon.color': '#434343',
  'menu.hoverIcon.color': '#e9e9e9',
  'menu.iconSize.width': '24px',
  'menu.iconSize.height': '24px',

  // submenu icons
  'submenu.normalIcon.color': '#8a8a8a',
  'submenu.activeIcon.color': '#e9e9e9',
  'submenu.iconSize.width': '32px',
  'submenu.iconSize.height': '32px',

  // submenu primary color
  'submenu.backgroundColor': '#1e1e1e',
  'submenu.partition.color': '#3c3c3c',

  // submenu labels
  'submenu.normalLabel.color': '#8a8a8a',
  'submenu.normalLabel.fontWeight': 'lighter',
  'submenu.activeLabel.color': '#fff',
  'submenu.activeLabel.fontWeight': 'lighter',

  // checkbox style
  'checkbox.border': '0px',
  'checkbox.backgroundColor': '#fff',

  // range style
  'range.pointer.color': '#fff',
  'range.bar.color': '#666',
  'range.subbar.color': '#d1d1d1',

  'range.disabledPointer.color': '#414141',
  'range.disabledBar.color': '#282828',
  'range.disabledSubbar.color': '#414141',

  'range.value.color': '#fff',
  'range.value.fontWeight': 'lighter',
  'range.value.fontSize': '11px',
  'range.value.border': '1px solid #353535',
  'range.value.backgroundColor': '#151515',
  'range.title.color': '#fff',
  'range.title.fontWeight': 'lighter',

  // colorpicker style
  'colorpicker.button.border': '1px solid #1e1e1e',
  'colorpicker.title.color': '#fff',
};

export class EditorTui extends UploaderBlock {
  couldBeCtxOwner = true;
  activityType = ActivityBlock.activities.EDITOR_TUI;
  static styleAttrs = ['uc-editor-tui'];

  get activityParams() {
    const params = super.activityParams;
    if ('internalId' in params) {
      return params;
    }
    throw new Error(`Cloud Image Editor activity params not found`);
  }

  initCallback() {
    super.initCallback();

    this.registerActivity(this.activityType, {
      onActivate: () => this.mounted(),
      onDeactivate: () => this.unmounted(),
    });
  }

  mounted() {
    const { internalId } = this.activityParams;
    this._entry = this.uploadCollection.read(internalId);

    if (!this._entry) {
      throw new Error(`Entry with internalId "${internalId}" not found`);
    }

    const file = this._entry.getValue('file');
    const cdnUrl = this._entry.getValue('cdnUrl');

    // @ts-ignore
    const instance = new tui.ImageEditor(document.querySelector('#tui-image-editor-container'), {
      includeUI: {
        loadImage: {
          path: URL.createObjectURL(file),
          name: 'SampleImage',
        },
        theme: blackTheme,
        initMenu: 'filter',
        menuBarPosition: 'bottom',
      },
      cssMaxWidth: 700,
      cssMaxHeight: 500,
      selectionStyle: {
        cornerSize: 20,
        rotatingPointOffset: 70,
      },
    });

    this._instance = instance;
  }

  unmounted() {
    this._instance = undefined;
    this._entry = undefined;
    // @ts-ignore
    document.querySelector('#tui-image-editor-container').innerHTML = '';
  }
}

EditorTui.template = `
  <div id="tui-image-editor-container" style="height: 800px"></div>
`;
