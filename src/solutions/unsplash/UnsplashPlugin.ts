import type { Plugin, PluginConfigOption } from '../../abstract/Plugin';
import type { PluginStateAPI } from '../../abstract/PluginStateAPI';

// Import the UnsplashActivity component
import '../../blocks/UnsplashActivity/UnsplashActivity';

/**
 * Plugin ID for the Unsplash source
 */
export const UNSPLASH_PLUGIN_ID = 'unsplash';

/**
 * Validator for string values
 */
const asString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

/**
 * Unsplash Plugin
 * Adds Unsplash as a custom upload source
 * 
 * Features:
 * - Custom source button in "start from" activity
 * - Unsplash image browser activity
 * - Click to add images from Unsplash to upload list
 */
export class UnsplashPlugin implements Plugin {
  public readonly pluginId = UNSPLASH_PLUGIN_ID;

  /**
   * Configuration options for the Unsplash plugin
   */
  public readonly config: Record<string, PluginConfigOption> = {
    unsplashAccessKey: {
      defaultValue: 'YOUR_UNSPLASH_ACCESS_KEY',
      validator: asString,
    },
  };

  /**
   * Initialize the plugin
   */
  public init(api: PluginStateAPI): void {
    // Register the Unsplash source button
    api.registerSource({
      type: 'unsplash',
      activity: 'unsplash',
      icon: 'unsplash',
      textKey: 'src-type-unsplash',
    });

    // Register the Unsplash activity
    api.registerActivity({
      activityType: 'unsplash',
      onActivate: () => {
        console.log('Unsplash activity activated');
      },
      onDeactivate: () => {
        console.log('Unsplash activity deactivated');
      },
    });

    // The UnsplashActivity component is registered via the import side-effect
    // Solutions will automatically detect and use it when the activity is activated
  }

  /**
   * Cleanup the plugin
   */
  public destroy(): void {
    // No cleanup needed - components remain registered
  }
}

/**
 * Factory function to create an Unsplash plugin instance
 */
export function createUnsplashPlugin(): UnsplashPlugin {
  return new UnsplashPlugin();
}
