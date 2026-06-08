import type { PluginDefinition } from '../../abstract/controllers/PluginRegistryController';
import { cameraPlugin } from '../../plugins/cameraPlugin';
import { cloudImageEditorPlugin } from '../../plugins/cloudImageEditorPlugin';
import { externalSourcesPlugin } from '../../plugins/externalSourcesPlugin';
import { imageShrinkPlugin } from '../../plugins/imageShrinkPlugin';
import { localSourcePlugin } from '../../plugins/localSourcePlugin';
import { urlSourcePlugin } from '../../plugins/urlSourcePlugin';

/**
 * Default plugins auto-installed by the v1-compat `<uc-file-uploader-*>`
 * shims. Mirrors v1's `fileUploaderLazyPlugins` minus the ones not yet
 * in the v2 spike (`instagramPlugin`). Native v2 tags like
 * `<uc-uploader-regular>` opt in explicitly via the `plugins` property;
 * the shim path is implicit for v1 parity.
 *
 * `cloudImageEditorPlugin` is a v1-shape plugin that flows through the
 * `setup({pluginApi, uploaderApi})` bridge — it registers the
 * `'edit-file'` file-action, the `'cloud-image-edit'` activity, and
 * the `file-upload-success` listener that auto-opens the editor when
 * `cloudImageEditorAutoOpen` / `cropPreset` is set.
 *
 * The plugins themselves no-op when their source / config gates aren't
 * met, so installing them all is cheap and matches v1's lazy
 * gate-on-config semantics close enough.
 */
export const fileUploaderDefaultPlugins: readonly PluginDefinition[] = Object.freeze([
  localSourcePlugin,
  urlSourcePlugin,
  cameraPlugin,
  externalSourcesPlugin,
  imageShrinkPlugin,
  cloudImageEditorPlugin as unknown as PluginDefinition,
]);
