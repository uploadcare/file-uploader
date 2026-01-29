# Plugin System

The File Uploader now supports a plugin system that allows you to extend its functionality. The Cloud Image Editor has been refactored to work as a plugin, demonstrating how the system works.

## Plugin API

### Plugin Interface

```typescript
interface Plugin {
  /**
   * Unique identifier for the plugin
   */
  pluginId: string;

  /**
   * Plugin initialization function called when plugin is registered
   */
  init(solution: LitSolutionBlock): void;

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
import type { Plugin } from '@uploadcare/file-uploader';
import type { LitSolutionBlock } from '@uploadcare/file-uploader';

export class MyCustomPlugin implements Plugin {
  public readonly pluginId = 'my-custom-plugin';

  public init(solution: LitSolutionBlock): void {
    // Initialize your plugin
    console.log('Plugin initialized on', solution);
    
    // Access the solution's configuration
    const config = solution.cfg;
    
    // Subscribe to state changes
    solution.sub('*uploadList', (list) => {
      console.log('Upload list changed:', list);
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

## Benefits of the Plugin System

1. **Modularity**: Features can be loaded on-demand, reducing initial bundle size
2. **Extensibility**: Developers can create custom plugins to add new functionality
3. **Backward Compatibility**: Existing code continues to work without changes
4. **Tree Shaking**: Unused plugins can be excluded from production builds

## Migration Guide

### For existing users

No changes required! The cloud image editor continues to work as before. It's now automatically imported in all file uploader solutions.

### For advanced users wanting smaller bundles

To exclude the cloud image editor and reduce bundle size:

1. Use a custom build configuration
2. Import individual components instead of the full bundle
3. Selectively register only the plugins you need

```javascript
// Custom minimal build without cloud image editor
import { FileUploaderRegular } from '@uploadcare/file-uploader/solutions/file-uploader/regular';
import { defineComponents } from '@uploadcare/file-uploader';

// Define only the components you need
defineComponents({
  FileUploaderRegular,
  // Don't import CloudImageEditorPlugin
});
```

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
