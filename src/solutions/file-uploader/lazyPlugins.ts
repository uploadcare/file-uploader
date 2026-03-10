import type { LazyPluginEntry } from '../../abstract/managers/plugin/LazyPluginLoader';
import { cameraPlugin } from '../../plugins/cameraPlugin';
import { cloudImageEditorPlugin } from '../../plugins/cloudImageEditorPlugin';
import { externalSourcesPlugin } from '../../plugins/externalSourcesPlugin';
import { imageShrinkPlugin } from '../../plugins/imageShrinkPlugin';
import { instagramPlugin } from '../../plugins/instagramPlugin';
import { urlSourcePlugin } from '../../plugins/urlSourcePlugin';
import { deserializeCsv } from '../../utils/comma-separated';
import { ExternalUploadSource } from '../../utils/UploadSource';

export const fileUploaderLazyPlugins: LazyPluginEntry[] = [
  {
    pluginId: 'cloud-image-editor',
    configDeps: ['useCloudImageEditor'],
    isEnabled: (get) => !!get('useCloudImageEditor'),
    load: () => cloudImageEditorPlugin,
  },
  {
    pluginId: 'image-shrink',
    configDeps: ['imageShrink'],
    isEnabled: (get) => !!get('imageShrink'),
    load: () => imageShrinkPlugin,
  },
  {
    pluginId: 'camera',
    configDeps: ['sourceList'],
    isEnabled: (get) => deserializeCsv(get('sourceList')).includes('camera'),
    load: () => cameraPlugin,
  },
  {
    pluginId: 'instagram',
    configDeps: ['sourceList'],
    isEnabled: (get) => deserializeCsv(get('sourceList')).includes('instagram'),
    load: () => instagramPlugin,
  },
  {
    pluginId: 'external-sources',
    configDeps: ['sourceList'],
    isEnabled: (get) =>
      Object.values(ExternalUploadSource).some((src) => deserializeCsv(get('sourceList')).includes(src)),
    load: () => externalSourcesPlugin,
  },
  {
    pluginId: 'url-source',
    configDeps: ['sourceList'],
    isEnabled: (get) => deserializeCsv(get('sourceList')).includes('url'),
    load: () => urlSourcePlugin,
  },
];
