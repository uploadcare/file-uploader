import type { LazyPluginEntryFactory } from '../../blocks/Config/lazyPluginRegistry';
import { cameraPlugin } from '../../plugins/cameraPlugin';
import { cloudImageEditorPlugin } from '../../plugins/cloudImageEditorPlugin';
import { externalSourcesPlugin } from '../../plugins/externalSourcesPlugin';
import { imageShrinkPlugin } from '../../plugins/imageShrinkPlugin';
import { instagramPlugin } from '../../plugins/instagramPlugin';
import { urlSourcePlugin } from '../../plugins/urlSourcePlugin';
import { deserializeCsv } from '../../utils/comma-separated';
import { ExternalUploadSource } from '../../utils/UploadSource';

export const fileUploaderLazyPlugins: LazyPluginEntryFactory = ({ useCloudImageEditor, imageShrink, sourceList }) => [
  {
    pluginId: 'cloud-image-editor',
    isEnabled: () => !!useCloudImageEditor(),
    load: () => cloudImageEditorPlugin,
  },
  {
    pluginId: 'image-shrink',
    isEnabled: () => !!imageShrink(),
    load: () => imageShrinkPlugin,
  },
  {
    pluginId: 'camera',
    isEnabled: () => deserializeCsv(sourceList()).includes('camera'),
    load: () => cameraPlugin,
  },
  {
    pluginId: 'instagram',
    isEnabled: () => deserializeCsv(sourceList()).includes('instagram'),
    load: () => instagramPlugin,
  },
  {
    pluginId: 'external-sources',
    isEnabled: () => Object.values(ExternalUploadSource).some((src) => deserializeCsv(sourceList()).includes(src)),
    load: () => externalSourcesPlugin,
  },
  {
    pluginId: 'url-source',
    isEnabled: () => deserializeCsv(sourceList()).includes('url'),
    load: () => urlSourcePlugin,
  },
];
