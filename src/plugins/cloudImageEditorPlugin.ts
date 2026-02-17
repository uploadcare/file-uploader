import { defineComponents } from '../abstract/defineComponents';
import type { UploaderPlugin } from '../abstract/managers/plugin';
import { ACTIVITY_TYPES } from '../lit/activity-constants';

const CLOUD_EDITOR_PLUGIN_ID = 'cloud-image-editor';

const EDIT_FILE_ICON_SVG =
  "<svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path fill='currentColor' fill-rule='evenodd' d='M18.558 2.804a.78.78 0 0 0-.557.235l-.008.007-2.472 2.46 3.847 3.848 2.46-2.473.004-.003a.78.78 0 0 0 0-1.108l-.004-.003-2.712-2.728a.78.78 0 0 0-.558-.235Zm-.248 7.613-3.852-3.852-8.93 8.887-1.516 5.41 5.41-1.515 8.888-8.93Zm-.636-8.934a2.28 2.28 0 0 1 2.512.505l2.702 2.717.002.002a2.278 2.278 0 0 1 0 3.234l-.002.002-12.541 12.602a.75.75 0 0 1-.33.193l-6.884 1.928a.75.75 0 0 1-.925-.924l1.928-6.885a.75.75 0 0 1 .193-.33l12.603-12.54a2.28 2.28 0 0 1 .742-.504Z' clip-rule='evenodd'/></svg>";

const editorI18n = {
  en: {
    'edit-image': 'Edit image',
    'edit-detail': 'Details',
    'file-item-edit-button': 'Edit',
    'a11y-editor-tab-filters': 'Filters',
    'a11y-editor-tab-tuning': 'Tuning',
    'a11y-editor-tab-crop': 'Crop',
    'a11y-cloud-editor-apply-filter': 'Apply {{name}} filter',
    'a11y-cloud-editor-apply-crop': 'Apply {{name}} operation',
    'a11y-cloud-editor-apply-tuning': 'Apply {{name}} tuning',
    'a11y-cloud-editor-apply-aspect-ratio': 'Apply operation {{name}} {{value}}',
    'crop-to-shape': 'Crop to {{value}}',
    custom: 'Freeform',
    'freeform-crop': 'Freeform crop',
    'cancel-edit': 'Cancel edit',
    back: 'Back',
    apply: 'Apply',
    rotate: 'Rotate',
    'flip-vertical': 'Flip vertical',
    'flip-horizontal': 'Flip horizontal',
    brightness: 'Brightness',
    contrast: 'Contrast',
    saturation: 'Saturation',
    exposure: 'Exposure',
    gamma: 'Gamma',
    vibrance: 'Vibrance',
    warmth: 'Warmth',
    enhance: 'Enhance',
    original: 'Original',
    resize: 'Resize image',
    crop: 'Crop',
    'select-color': 'Select color',
    text: 'Text',
    draw: 'Draw',
    'tab-view': 'Preview',
    'tab-details': 'Details',
  },
};

const loadEditorModule = async () => {
  const [cloudEditorModules, activityModule] = await Promise.all([
    import('../solutions/cloud-image-editor'),
    import('../blocks/CloudImageEditorActivity/CloudImageEditorActivity'),
  ]);

  defineComponents({
    ...cloudEditorModules,
    ...activityModule,
  });
};

export const cloudImageEditorPlugin: UploaderPlugin = {
  id: CLOUD_EDITOR_PLUGIN_ID,
  version: '0.1.0',
  setup: async ({ pluginApi, uploaderApi }) => {
    await loadEditorModule();

    pluginApi.registry.registerIcon({
      name: 'edit-file',
      svg: EDIT_FILE_ICON_SVG,
    });

    pluginApi.registry.registerI18n(editorI18n);

    pluginApi.registry.registerFileAction({
      id: 'edit-file',
      icon: 'edit-file',
      shouldRender: (fileEntry) => Boolean(fileEntry.isSuccess && fileEntry.isImage && fileEntry.cdnUrl),
      onClick: (fileEntry) => {
        uploaderApi.setCurrentActivity?.(ACTIVITY_TYPES.CLOUD_IMG_EDIT, {
          internalId: fileEntry.internalId,
        });
        uploaderApi.setModalState?.(true);
      },
    });

    pluginApi.registry.registerActivity({
      id: ACTIVITY_TYPES.CLOUD_IMG_EDIT,
      render: (host) => {
        const activityEl = document.createElement('uc-cloud-image-editor-activity');
        host.append(activityEl);

        return () => {
          host.replaceChildren();
        };
      },
    });
  },
};

export default cloudImageEditorPlugin;
