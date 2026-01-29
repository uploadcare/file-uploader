# Plugin System

The File Uploader now supports a plugin system that allows you to extend its functionality. The Cloud Image Editor has been refactored to work as a plugin, demonstrating how the system works.

> **📘 Enhanced Plugin System**  
> For advanced features including plugin-specific configuration, state management API, and custom tabs/sources, see [PLUGIN_SYSTEM_ENHANCED.md](./PLUGIN_SYSTEM_ENHANCED.md)

## Plugin API

### Plugin Interface

```typescript
interface Plugin {
  /**
   * Unique identifier for the plugin
   */
  pluginId: string;

  /**
   * Optional configuration options defined by the plugin
   */
  config?: Record<string, PluginConfigOption>;

  /**
   * Plugin initialization function called when plugin is registered
   * @param api - Plugin state API for controlled access to solution state
   */
  init(api: PluginStateAPI): void;

  /**
   * Optional cleanup function called when solution is destroyed
   */
  destroy?(): void;
}
```

### Registering Plugins

#### Method 1: Using the Cloud Image Editor Plugin (Default)

The cloud image editor is included by default in all file uploader solutions for backward compatibility:

```javascript
import { FileUploaderRegular } from '@uploadcare/file-uploader';

// Cloud image editor is automatically available
const uploader = document.createElement('uc-file-uploader-regular');
document.body.appendChild(uploader);
```

#### Method 2: Manual Plugin Registration

For custom builds or lazy loading, you can register plugins manually:

```javascript
import { FileUploaderRegular } from '@uploadcare/file-uploader';
import { createCloudImageEditorPlugin } from '@uploadcare/file-uploader/solutions/cloud-image-editor';

const uploader = document.createElement('uc-file-uploader-regular');

// Register the cloud image editor plugin
uploader.registerPlugin({
  plugin: createCloudImageEditorPlugin(),
});

document.body.appendChild(uploader);
```

#### Method 3: Programmatic API

You can also register plugins programmatically after the element is created:

```javascript
import { FileUploaderRegular } from '@uploadcare/file-uploader';
import { createCloudImageEditorPlugin } from '@uploadcare/file-uploader/solutions/cloud-image-editor';

const uploader = new FileUploaderRegular();

// Register plugin before initialization
uploader.registerPlugin({
  plugin: createCloudImageEditorPlugin(),
});

// Plugin is initialized when the uploader is connected to the DOM
document.body.appendChild(uploader);
```

## Creating Custom Plugins

You can create custom plugins to extend the file uploader functionality:

```typescript
import type { Plugin, PluginStateAPI } from '@uploadcare/file-uploader';

export class MyCustomPlugin implements Plugin {
  public readonly pluginId = 'my-custom-plugin';

  public init(api: PluginStateAPI): void {
    // Initialize your plugin
    console.log('Plugin initialized');
    
    // Access configuration
    const config = api.getConfigValue('someOption');
    
    // Subscribe to state changes
    api.subscribe('*uploadList', (list) => {
      console.log('Upload list changed:', list);
    });

    // Subscribe to config changes
    api.subConfigValue('someOption', (value) => {
      console.log('Config option changed:', value);
    });
  }

  public destroy(): void {
    // Cleanup when the solution is destroyed
    console.log('Plugin destroyed');
  }
}

// Use the plugin
import { FileUploaderRegular } from '@uploadcare/file-uploader';

const uploader = new FileUploaderRegular();
uploader.registerPlugin({
  plugin: new MyCustomPlugin(),
});
```

### Plugin with Configuration

Plugins can declare their own configuration options:

```typescript
import type { Plugin, PluginStateAPI, PluginConfigOption } from '@uploadcare/file-uploader';

export class MyConfigurablePlugin implements Plugin {
  public readonly pluginId = 'my-configurable-plugin';

  // Declare plugin-specific config
  public readonly config: Record<string, PluginConfigOption> = {
    myPluginEnabled: {
      defaultValue: true,
      validator: (value) => Boolean(value),
    },
    myPluginColor: {
      defaultValue: '#ff0000',
      validator: (value) => String(value),
    },
  };

  public init(api: PluginStateAPI): void {
    // Access plugin config
    const enabled = api.getConfigValue('myPluginEnabled');
    const color = api.getConfigValue('myPluginColor');

    console.log('Plugin enabled:', enabled);
    console.log('Plugin color:', color);

    // Subscribe to config changes
    api.subConfigValue('myPluginEnabled', (value) => {
      console.log('Plugin enabled changed to:', value);
    });
  }
}

## Benefits of the Plugin System

1. **Modularity**: Features can be loaded on-demand, reducing initial bundle size
2. **Extensibility**: Developers can create custom plugins to add new functionality
3. **Backward Compatibility**: Existing code continues to work without changes
4. **Tree Shaking**: Unused plugins can be excluded from production builds

## Migration Guide

### For existing users

No changes required! The cloud image editor continues to work as before. It's now automatically imported in all file uploader solutions.

### For advanced users wanting smaller bundles

To exclude the cloud image editor and reduce bundle size, you can create a custom build using a bundler like webpack, rollup, or vite. Import only the components you need and use tree shaking to eliminate unused code. This typically requires custom build configuration and is beyond the scope of this documentation.

## Plugin Lifecycle

1. **Registration**: Plugin is registered via `registerPlugin()`
2. **Initialization**: Plugin's `init()` method is called when the solution initializes
3. **Active**: Plugin is active and can interact with the solution
4. **Destruction**: Plugin's `destroy()` method is called when the solution disconnects

## Available Plugins

### Cloud Image Editor Plugin

The Cloud Image Editor plugin adds image editing capabilities:

- Crop images
- Apply filters
- Rotate and flip images
- Adjust brightness and contrast

```javascript
import { createCloudImageEditorPlugin } from '@uploadcare/file-uploader/solutions/cloud-image-editor';

const plugin = createCloudImageEditorPlugin();
```
