# Unsplash Plugin Documentation

## Overview

The Unsplash plugin adds Unsplash as a custom upload source to the file uploader. Users can browse and search Unsplash images and add them to their upload list by URL.

## Features

- ✅ Custom "Unsplash" source button in file picker
- ✅ Browse featured Unsplash photos
- ✅ Search Unsplash library
- ✅ Click to add images to upload list
- ✅ Configurable via plugin config
- ✅ Complete plugin architecture demonstration

## Installation

The Unsplash plugin is included with the file uploader package.

```typescript
import { FileUploaderRegular, createUnsplashPlugin } from '@uploadcare/file-uploader';
```

## Basic Usage

```typescript
import { FileUploaderRegular, createUnsplashPlugin } from '@uploadcare/file-uploader';

const uploader = new FileUploaderRegular();

// Register the Unsplash plugin
uploader.registerPlugin({
  plugin: createUnsplashPlugin(),
});

// Configure Unsplash access key (required)
uploader.setAttribute('unsplash-access-key', 'YOUR_UNSPLASH_ACCESS_KEY');

// Add unsplash to source list
uploader.setAttribute('source-list', 'local, url, unsplash, camera');

// Add to page
document.body.appendChild(uploader);
```

## Getting an Unsplash Access Key

1. Go to [Unsplash Developers](https://unsplash.com/developers)
2. Sign up or log in to your account
3. Click "New Application"
4. Accept the API Terms
5. Fill in the application details
6. Copy your **Access Key**

### Free Tier Limits

- 50 requests per hour (demo/development)
- For production use, you may need to apply for production access

## Configuration

The plugin accepts the following configuration option:

| Config Option | Type | Default | Description |
|--------------|------|---------|-------------|
| `unsplashAccessKey` | string | `'YOUR_UNSPLASH_ACCESS_KEY'` | Your Unsplash API access key |

### Setting Config

```typescript
// Via attribute
uploader.setAttribute('unsplash-access-key', 'abc123xyz');

// Via config object
uploader.cfg.unsplashAccessKey = 'abc123xyz';
```

## Adding to Source List

To make the Unsplash button appear in the file picker, add `'unsplash'` to the source list:

```typescript
uploader.setAttribute('source-list', 'local, url, unsplash, camera, dropbox');
```

## How It Works

### 1. Plugin Registration

The UnsplashPlugin uses the enhanced plugin system:

```typescript
class UnsplashPlugin implements Plugin {
  pluginId = 'unsplash';
  
  config = {
    unsplashAccessKey: {
      defaultValue: 'YOUR_UNSPLASH_ACCESS_KEY',
      validator: (value) => String(value),
    },
  };

  init(api: PluginStateAPI) {
    // Register custom source button
    api.registerSource({
      type: 'unsplash',
      activity: 'unsplash',
      icon: 'unsplash',
      textKey: 'src-type-unsplash',
    });

    // Register activity
    api.registerActivity({
      activityType: 'unsplash',
      onActivate: () => console.log('Unsplash opened'),
    });
  }
}
```

### 2. Custom Activity

The UnsplashActivity component:
- Extends `LitUploaderBlock`
- Fetches images from Unsplash API
- Renders image grid with Lit
- Handles image selection
- Adds images via `api.addFileFromUrl()`

### 3. Source Button Integration

The SourceBtn component automatically picks up custom sources:
- Checks `*customSources` state during initialization
- Registers plugin sources alongside built-in sources
- No core code modification required

## API Methods

### createUnsplashPlugin()

Factory function to create an Unsplash plugin instance.

```typescript
const plugin = createUnsplashPlugin();
uploader.registerPlugin({ plugin });
```

## User Flow

1. User clicks "Unsplash" button in file picker
2. Unsplash activity opens showing featured photos
3. User can search for specific images
4. User clicks an image
5. Image is added to upload list by URL
6. User returns to upload list

## Customization

### Custom Unsplash Query

You can extend the UnsplashPlugin to customize the default query:

```typescript
import { UnsplashPlugin } from '@uploadcare/file-uploader';

class CustomUnsplashPlugin extends UnsplashPlugin {
  init(api: PluginStateAPI) {
    super.init(api);
    
    // Subscribe to config for custom behavior
    api.subConfigValue('unsplashDefaultQuery', (query) => {
      console.log('Default query:', query);
    });
  }
}
```

### Styling

The Unsplash activity can be styled via CSS:

```css
.unsplash-activity {
  /* Custom styles */
}

.unsplash-grid {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.unsplash-image:hover {
  transform: scale(1.1);
}
```

## Architecture

The Unsplash plugin demonstrates the complete enhanced plugin architecture:

### Plugin-Specific Configuration
- Declares `unsplashAccessKey` config option
- Automatically registered when plugin loads
- Accessed via controlled state API

### State Wrapper API
- Uses `PluginStateAPI` instead of direct solution access
- Calls `registerSource()` and `registerActivity()`
- Safe, controlled access to solution state

### Custom Activity
- Implements custom UI with Lit
- Renders outside of iframe (unlike ExternalSource)
- Full control over behavior and styling

### Source Registration
- Adds custom button to file picker
- Integrates seamlessly with built-in sources
- Configurable via `source-list` attribute

## Attribution

When using Unsplash images, you should attribute the photographer according to [Unsplash's API Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines).

The plugin displays photographer attribution in the image overlay.

## Troubleshooting

### "Unsplash API error: Unauthorized"

- Verify your access key is correct
- Check that the key is set before the plugin initializes
- Ensure your Unsplash app is active

### Unsplash button doesn't appear

- Check that 'unsplash' is in the `source-list` attribute
- Verify the plugin is registered before the uploader is added to DOM
- Check browser console for errors

### Images not loading

- Verify your Unsplash access key
- Check network tab for API request failures
- Ensure CORS is configured properly (Unsplash API allows CORS)

## Example: Complete Implementation

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="node_modules/@uploadcare/file-uploader/dist/index.css">
</head>
<body>
  <script type="module">
    import { 
      FileUploaderRegular, 
      createUnsplashPlugin 
    } from '@uploadcare/file-uploader';

    const uploader = new FileUploaderRegular();
    
    // Register plugin
    uploader.registerPlugin({
      plugin: createUnsplashPlugin(),
    });
    
    // Configure
    uploader.setAttribute('ctx-name', 'my-uploader');
    uploader.setAttribute('pubkey', 'YOUR_UPLOADCARE_PUBLIC_KEY');
    uploader.setAttribute('unsplash-access-key', 'YOUR_UNSPLASH_ACCESS_KEY');
    uploader.setAttribute('source-list', 'local, url, unsplash, camera');
    
    document.body.appendChild(uploader);
  </script>
</body>
</html>
```

## License

The Unsplash plugin is part of the file uploader package and follows the same MIT license.

## Related

- [Plugin System Documentation](./PLUGIN_SYSTEM.md)
- [Enhanced Plugin System](./PLUGIN_SYSTEM_ENHANCED.md)
- [Unsplash API Documentation](https://unsplash.com/documentation)
