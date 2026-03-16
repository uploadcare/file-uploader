import type { LazyPluginEntry } from '../../abstract/managers/plugin/LazyPluginLoader';
import { cameraPlugin } from '../../plugins/cameraPlugin';
import { cloudImageEditorPlugin } from '../../plugins/cloudImageEditorPlugin';
import { externalSourcesPlugin } from '../../plugins/externalSourcesPlugin';
import { imageShrinkPlugin } from '../../plugins/imageShrinkPlugin';
import { instagramPlugin } from '../../plugins/instagramPlugin';
import { localSourcePlugin } from '../../plugins/localSourcePlugin';
import { urlSourcePlugin } from '../../plugins/urlSourcePlugin';
import { deserializeCsv } from '../../utils/comma-separated';
import { ExternalUploadSource, UploadSource } from '../../utils/UploadSource';

export const fileUploaderLazyPlugins: LazyPluginEntry[] = [
  {
    configDeps: ['useCloudImageEditor'],
    isEnabled: (get) => !!get('useCloudImageEditor'),
    load: () => cloudImageEditorPlugin,
  },
  {
    configDeps: ['imageShrink'],
    isEnabled: (get) => !!get('imageShrink'),
    load: () => imageShrinkPlugin,
  },
  {
    configDeps: ['sourceList'],
    isEnabled: (get) => deserializeCsv(get('sourceList')).includes(UploadSource.LOCAL),
    load: () => localSourcePlugin,
  },
  {
    configDeps: ['sourceList'],
    isEnabled: (get) => deserializeCsv(get('sourceList')).includes(UploadSource.CAMERA),
    load: () => cameraPlugin,
  },
  {
    configDeps: ['sourceList'],
    isEnabled: (get) => deserializeCsv(get('sourceList')).includes('instagram'),
    load: () => instagramPlugin,
  },
  {
    configDeps: ['sourceList'],
    isEnabled: (get) =>
      Object.values(ExternalUploadSource).some((src) => deserializeCsv(get('sourceList')).includes(src)),
    load: () => externalSourcesPlugin,
  },
  {
    configDeps: ['sourceList'],
    isEnabled: (get) => deserializeCsv(get('sourceList')).includes(UploadSource.URL),
    load: () => urlSourcePlugin,
  },
];
