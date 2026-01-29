import type { Plugin, PluginConfigOption } from '../../abstract/Plugin';
import type { PluginStateAPI } from '../../abstract/PluginStateAPI';

// Import the CloudImageEditorActivity block
import '../../blocks/CloudImageEditorActivity/CloudImageEditorActivity';

/**
 * Plugin ID for the cloud image editor
 */
export const CLOUD_IMAGE_EDITOR_PLUGIN_ID = 'cloud-image-editor';

/**
 * Validator for boolean values
 */
const asBoolean = (value: unknown): boolean => {
  return Boolean(value);
};

/**
 * Validator for string values
 */
const asString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
};

/**
 * Cloud Image Editor Plugin
 * Adds image editing capabilities to the file uploader
 *
 * This plugin ensures the CloudImageEditorActivity component is loaded
 * and declares its own configuration options.
 */
export class CloudImageEditorPlugin implements Plugin {
  public readonly pluginId = CLOUD_IMAGE_EDITOR_PLUGIN_ID;

  /**
   * Configuration options for the cloud image editor plugin
   */
  public readonly config: Record<string, PluginConfigOption> = {
    cloudImageEditorAutoOpen: {
      defaultValue: false,
      validator: asBoolean,
    },
    cloudImageEditorMaskHref: {
      defaultValue: null,
      validator: asString,
    },
  };

  /**
   * Initialize the plugin
   * The import side effect ensures uc-cloud-image-editor-activity is registered
   */
  public init(_api: PluginStateAPI): void {
    // The import at the top of this file ensures the CloudImageEditorActivity
    // component is registered. The solutions will automatically detect its
    // presence via customElements.get('uc-cloud-image-editor-activity')
    // and include it in their render output.
    
    // In the future, we could use the api to:
    // - Register custom activities
    // - Subscribe to events
    // - Add custom behaviors
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
