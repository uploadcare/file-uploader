import { defineComponents } from '../abstract/defineComponents';
import { UploaderEventType as EventType } from '../abstract/EventBus';
import type { LegacyUploaderPlugin as UploaderPlugin } from '../abstract/plugin-types-legacy';
import { calculateMaxCenteredCropFrame } from '../blocks/CloudImageEditor/src/crop-utils';
import { parseCropPreset } from '../blocks/CloudImageEditor/src/lib/parseCropPreset';
import * as cloudImageEditorActivityModule from '../blocks/CloudImageEditorActivity/CloudImageEditorActivity';
import { ACTIVITY_TYPES } from '../lit/activity-constants';
import * as cloudEditorModules from '../solutions/cloud-image-editor';
import { createCdnUrl, createCdnUrlModifiers } from '../utils/cdn-utils';

const CLOUD_EDITOR_PLUGIN_ID = 'cloud-image-editor';

const EDIT_FILE_ICON_SVG =
  "<svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path fill='currentColor' fill-rule='evenodd' d='M18.558 2.804a.78.78 0 0 0-.557.235l-.008.007-2.472 2.46 3.847 3.848 2.46-2.473.004-.003a.78.78 0 0 0 0-1.108l-.004-.003-2.712-2.728a.78.78 0 0 0-.558-.235Zm-.248 7.613-3.852-3.852-8.93 8.887-1.516 5.41 5.41-1.515 8.888-8.93Zm-.636-8.934a2.28 2.28 0 0 1 2.512.505l2.702 2.717.002.002a2.278 2.278 0 0 1 0 3.234l-.002.002-12.541 12.602a.75.75 0 0 1-.33.193l-6.884 1.928a.75.75 0 0 1-.925-.924l1.928-6.885a.75.75 0 0 1 .193-.33l12.603-12.54a2.28 2.28 0 0 1 .742-.504Z' clip-rule='evenodd'/></svg>";

export const cloudImageEditorPlugin: UploaderPlugin = {
  id: CLOUD_EDITOR_PLUGIN_ID,
  setup: async ({ pluginApi, uploaderApi }) => {
    defineComponents({ ...cloudEditorModules, ...cloudImageEditorActivityModule });

    pluginApi.registry.registerIcon({
      name: 'edit-file',
      svg: EDIT_FILE_ICON_SVG,
    });

    pluginApi.registry.registerFileAction({
      id: 'edit-file',
      icon: 'edit-file',
      label: 'file-item-edit-button',
      shouldRender: (fileEntry) => Boolean(fileEntry.isImage && fileEntry.cdnUrl),
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

    const unsubscribe = uploaderApi.on(EventType.FILE_UPLOAD_SUCCESS, (fileEntry) => {
      if (!fileEntry.isImage) return;

      const cropPreset = pluginApi.config.get('cropPreset');
      const useEditor = pluginApi.config.get('useCloudImageEditor');
      const autoOpen = pluginApi.config.get('cloudImageEditorAutoOpen');
      const collectionSize = uploaderApi._uploadCollection.size;

      // v1 parity (`LitUploaderBlock._setInitialCrop`): when `cropPreset`
      // is configured, auto-apply a max-centered crop modifier to each
      // image entry on upload. Runs regardless of `useCloudImageEditor`
      // so consumers can pre-crop without opening the editor.
      if (cropPreset && fileEntry.cdnUrl && !fileEntry.cdnUrlModifiers?.includes('/crop/')) {
        applyCropPreset(fileEntry, cropPreset, pluginApi);
      }

      if (useEditor && collectionSize === 1 && (cropPreset || autoOpen)) {
        uploaderApi.setCurrentActivity?.(ACTIVITY_TYPES.CLOUD_IMG_EDIT, {
          internalId: fileEntry.internalId,
        });
        uploaderApi.setModalState?.(true);
      }
    });

    return unsubscribe;
  },
};

function applyCropPreset(
  fileEntry: import('../types/exported').OutputFileEntry<'success'>,
  cropPreset: string,
  pluginApi: { files: { update: (id: string, changes: { cdnUrl?: string; cdnUrlModifiers?: string }) => void } },
): void {
  const presets = parseCropPreset(cropPreset);
  if (!presets.length) return;
  const [aspectRatioPreset] = presets;
  const imageInfo = fileEntry.fileInfo?.imageInfo;
  if (!imageInfo) {
    console.warn('[cloud-image-editor] cropPreset auto-apply skipped — no imageInfo', {
      internalId: fileEntry.internalId,
    });
    return;
  }
  const { width, height } = imageInfo;
  const aspectRatio =
    typeof aspectRatioPreset?.width === 'number' &&
    typeof aspectRatioPreset?.height === 'number' &&
    aspectRatioPreset.width > 0 &&
    aspectRatioPreset.height > 0
      ? aspectRatioPreset.width / aspectRatioPreset.height
      : 1;
  const crop = calculateMaxCenteredCropFrame(width, height, aspectRatio);
  const cdnUrlModifiers = createCdnUrlModifiers(`crop/${crop.width}x${crop.height}/${crop.x},${crop.y}`, 'preview');
  pluginApi.files.update(fileEntry.internalId, {
    cdnUrlModifiers,
    cdnUrl: createCdnUrl(fileEntry.cdnUrl as string, cdnUrlModifiers),
  });
}
