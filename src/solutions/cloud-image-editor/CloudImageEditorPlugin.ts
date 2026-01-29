import type { Plugin } from '../../abstract/Plugin';
import type { LitSolutionBlock } from '../../lit/LitSolutionBlock';

// Import the CloudImageEditorActivity block
import '../../blocks/CloudImageEditorActivity/CloudImageEditorActivity';

/**
 * Plugin ID for the cloud image editor
 */
export const CLOUD_IMAGE_EDITOR_PLUGIN_ID = 'cloud-image-editor';

/**
 * Cloud Image Editor Plugin
 * Adds image editing capabilities to the file uploader
 *
 * This plugin ensures the CloudImageEditorActivity component is loaded.
 * The file uploader solutions will automatically detect and use it when available.
 */
export class CloudImageEditorPlugin implements Plugin {
  public readonly pluginId = CLOUD_IMAGE_EDITOR_PLUGIN_ID;

  /**
   * Initialize the plugin
   * The import side effect ensures uc-cloud-image-editor-activity is registered
   */
  public init(_solution: LitSolutionBlock): void {
    // The import at the top of this file ensures the CloudImageEditorActivity
    // component is registered. The solutions will automatically detect its
    // presence via customElements.get('uc-cloud-image-editor-activity')
    // and include it in their render output.
  }

  /**
   * Cleanup the plugin
   */
  public destroy(): void {
    // No cleanup needed - custom elements remain registered
  }
}

/**
 * Factory function to create a cloud image editor plugin instance
 */
export function createCloudImageEditorPlugin(): CloudImageEditorPlugin {
  return new CloudImageEditorPlugin();
}
