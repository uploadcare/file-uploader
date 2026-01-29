# Enhanced Plugin System Documentation

## Overview

The file uploader now features an enhanced plugin system that allows plugins to:
1. Declare their own configuration options
2. Access state through a safe, controlled API
3. Register custom tabs, sources, and activities

## Plugin State API

Plugins no longer receive direct access to the solution block. Instead, they receive a `PluginStateAPI` object that provides controlled access to essential functionality.

### Available Methods

```typescript
interface PluginStateAPI {
  // Config management
  subConfigValue<T>(key: T, callback: (value) => void): () => void;
  getConfigValue<T>(key: T): value;
  setConfigValue<T>(key: T, value): void;

  // State management
  subscribe<T>(key: string, callback: (value: T) => void): () => void;
  getState<T>(key: string): T;
  setState<T>(key: string, value: T): void;

  // Navigation
  setActivity(activityType: string, params?: Record<string, unknown>): void;
  historyBack(): void;

  // Registration
  registerSource(config: PluginSourceConfig): void;
  registerActivity(config: PluginActivityConfig): void;

  // Localization
  l10n(key: string): string;
}
```

## Plugin Configuration

Plugins can now declare their own configuration options:

```typescript
import type { Plugin, PluginConfigOption } from '@uploadcare/file-uploader';

class MyPlugin implements Plugin {
  pluginId = 'my-plugin';

  // Declare config options
  config: Record<string, PluginConfigOption> = {
    myPluginEnabled: {
      defaultValue: true,
      validator: (value) => Boolean(value),
    },
    myPluginOption: {
      defaultValue: 'default-value',
      validator: (value) => String(value),
    },
  };

  init(api: PluginStateAPI) {
    // Access config values
    const enabled = api.getConfigValue('myPluginEnabled');
    
    // Subscribe to config changes
    api.subConfigValue('myPluginOption', (value) => {
      console.log('Option changed:', value);
    });
  }
}
```

### Config Validators

The validator function is called whenever a config value is set. It should:
- Accept the raw value (unknown type)
- Validate and normalize the value
- Return the normalized value

Common validators:
```typescript
const asBoolean = (value: unknown): boolean => Boolean(value);
const asString = (value: unknown): string | null => 
  value == null ? null : String(value);
const asNumber = (value: unknown): number => Number(value) || 0;
```

## Custom Sources and Tabs

Plugins can register custom source buttons that appear in the file picker:

```typescript
class MySourcePlugin implements Plugin {
  pluginId = 'my-source';

  init(api: PluginStateAPI) {
    // Register a custom source
    api.registerSource({
      type: 'my-source',
      activity: 'my-custom-activity',
      icon: 'my-icon',
      textKey: 'my-source-button-text',
      activate: () => {
        // Custom activation logic
        api.setActivity('my-custom-activity');
      },
    });

    // Register the activity
    api.registerActivity({
      activityType: 'my-custom-activity',
      onActivate: () => {
        console.log('My activity activated');
      },
      onDeactivate: () => {
        console.log('My activity deactivated');
      },
    });
  }
}
```

### Source Configuration

```typescript
interface PluginSourceConfig {
  type: string;              // Unique identifier
  activity: string;          // Activity to open
  icon?: string;            // Icon name
  textKey?: string;         // Localization key
  activate?: () => void;    // Custom activation handler
}
```

### Activity Configuration

```typescript
interface PluginActivityConfig {
  activityType: string;             // Unique identifier
  onActivate?: () => void;          // Called when activated
  onDeactivate?: () => void;        // Called when deactivated
}
```

## State Management

Plugins can access and modify shared state:

```typescript
class MyPlugin implements Plugin {
  pluginId = 'my-plugin';

  init(api: PluginStateAPI) {
    // Subscribe to upload list changes
    api.subscribe('*uploadList', (list) => {
      console.log('Upload list changed:', list);
    });

    // Get current state
    const currentActivity = api.getState('*currentActivity');

    // Set state
    api.setState('*customState', { foo: 'bar' });
  }
}
```

### Common State Keys

- `*currentActivity` - Currently active activity
- `*currentActivityParams` - Parameters for current activity
- `*uploadList` - List of uploaded files
- `*history` - Activity navigation history
- `*customSources` - Custom source configurations

## Complete Example: Cloud Image Editor Plugin

```typescript
import type { Plugin, PluginConfigOption, PluginStateAPI } from '@uploadcare/file-uploader';

const asBoolean = (value: unknown): boolean => Boolean(value);
const asString = (value: unknown): string | null => 
  value == null ? null : String(value);

export class CloudImageEditorPlugin implements Plugin {
  pluginId = 'cloud-image-editor';

  // Declare plugin-specific config
  config: Record<string, PluginConfigOption> = {
    cloudImageEditorAutoOpen: {
      defaultValue: false,
      validator: asBoolean,
    },
    cloudImageEditorMaskHref: {
      defaultValue: null,
      validator: asString,
    },
  };

  init(api: PluginStateAPI) {
    // The component is registered via side-effect import
    // Solutions will automatically detect and use it

    // You could add custom behavior:
    api.subConfigValue('cloudImageEditorAutoOpen', (autoOpen) => {
      if (autoOpen) {
        // Custom logic when auto-open is enabled
      }
    });
  }

  destroy() {
    // Cleanup if needed
  }
}
```

## Migration from Old Plugin System

### Before (direct solution access):

```typescript
class OldPlugin implements Plugin {
  init(solution: LitSolutionBlock) {
    // Direct access to solution internals
    solution.cfg.myOption = 'value';
    solution.sub('*uploadList', callback);
  }
}
```

### After (state API):

```typescript
class NewPlugin implements Plugin {
  config = {
    myOption: {
      defaultValue: 'default',
      validator: (v) => String(v),
    },
  };

  init(api: PluginStateAPI) {
    // Controlled access via API
    api.setConfigValue('myOption', 'value');
    api.subscribe('*uploadList', callback);
  }
}
```

## Benefits

1. **Encapsulation**: Plugins can't accidentally break solution internals
2. **Type Safety**: State API provides clear contracts
3. **Self-Documenting**: Config options are declared with defaults and validators
4. **Extensibility**: Easy to add custom sources and activities
5. **Maintainability**: Clear separation between plugin and core functionality

## Best Practices

1. **Always declare config options** in the plugin, not in core
2. **Use validators** to ensure type safety
3. **Subscribe to state** instead of polling
4. **Clean up** in the destroy method if you create subscriptions
5. **Use meaningful names** for custom sources and activities
6. **Test thoroughly** with the state API mocked
