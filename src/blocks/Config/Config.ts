// @ts-check
import type { CustomConfig } from '../../abstract/customConfigOptions';
import type { PluginManager } from '../../abstract/managers/plugin';
import { sharedConfigKey } from '../../abstract/sharedConfigKey';
import type { ConfigComplexType, ConfigPlainType, ConfigType } from '../../types';
import { toKebabCase } from '../../utils/toKebabCase';
import { runAssertions } from './assertions';
import './config.css';
import { LitBlock } from '../../lit/LitBlock';
import { computeProperty } from './computed-properties';
import { initialConfig } from './initialConfig';
import { normalizeConfigValue } from './normalizeConfigValue';

const allConfigKeys = [
  // "debug" option should go first to be able to print debug messages from the very beginning
  ...new Set(['debug', ...Object.keys(initialConfig)]),
] as Array<keyof ConfigType>;

/**
 * Config keys that can't be passed as attribute (because they are object or function)
 */
export const complexConfigKeys = [
  'metadata',
  'plugins',
  'localeDefinitionOverride',
  'secureUploadsSignatureResolver',
  'secureDeliveryProxyUrlResolver',
  'iconHrefResolver',
  'fileValidators',
  'collectionValidators',
  'mediaRecorderOptions',
] as const;

const isComplexKey = (key: keyof ConfigType): key is keyof ConfigComplexType =>
  complexConfigKeys.includes(key as unknown as (typeof complexConfigKeys)[number]);

/** Config keys that can be passed as attribute */
const plainConfigKeys = allConfigKeys.filter((key) => !isComplexKey(key)) as (keyof ConfigPlainType)[];

/**
 * Mapping of attribute names to config keys Kebab-case and lowercase are supported. lowercase could be used by
 * frameworks like vue and react.
 */
const builtinAttrKeyMapping: Record<string, keyof ConfigPlainType> = {
  ...Object.fromEntries(plainConfigKeys.map((key) => [toKebabCase(key), key])),
  ...Object.fromEntries(plainConfigKeys.map((key) => [key.toLowerCase(), key])),
};

const getLocalPropName = (key: string) => `__${key}`;

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: This is intentional interface merging, used to add configuration setters/getters
export class Config extends LitBlock {
  public declare attributesMeta: Partial<ConfigPlainType> & {
    'ctx-name': string;
  };

  public override init$ = {
    ...this.init$,
    ...Object.fromEntries(
      Object.entries(initialConfig).map(([key, value]) => [sharedConfigKey(key as keyof ConfigType), value]),
    ),
  } as unknown as LitBlock['init$'] & ConfigType;

  private _computationControllers: Map<keyof ConfigType, AbortController> = new Map();
  private _pluginChangeUnsubscribe?: () => void;
  private _mutationObserver?: MutationObserver;

  /**
   * Mapping of attribute names to custom config keys for plugin-registered configs.
   * Updated dynamically when plugins are registered or changed.
   * Similar to builtinAttrKeyMapping but for custom configs.
   */
  private _customAttrKeyMapping: Record<string, string> = {};

  /**
   * Map of custom config subscriptions (config name -> unsubscribe function)
   * Used to track and clean up subscriptions when plugins change
   */
  private _customConfigSubscriptions: Map<string, () => void> = new Map();

  /**
   * Check if a key is a custom config (registered by plugins)
   */
  private _isCustomConfig(key: string): boolean {
    return key in this._customAttrKeyMapping || Object.values(this._customAttrKeyMapping).includes(key);
  }

  /**
   * Get the custom config definition for a key
   */
  private _getCustomConfigDefinition(key: string) {
    const pluginManager = this._sharedInstancesBag.pluginManager;
    if (!pluginManager) return undefined;
    return pluginManager.configRegistry.get(key);
  }

  /**
   * Get attribute names for a config key (kebab-case and lowercase)
   */
  private _getAttributeNames(key: string): string[] {
    return [...new Set([toKebabCase(key), key.toLowerCase()])];
  }

  private _flushValueToAttribute(key: string, value: unknown) {
    // Check if it's a complex built-in key
    if (isComplexKey(key as keyof ConfigType)) {
      return; // Complex keys can't be represented as attributes
    }

    // Check if it's a custom config with attribute: false
    if (this._isCustomConfig(key)) {
      const config = this._getCustomConfigDefinition(key);
      // Skip if attribute is explicitly false (default is true, so flush unless false)
      if (config?.attribute === false) {
        return;
      }
    }

    // Flush the value to the DOM attributes (works for both built-in and custom configs)
    const attrs = this._getAttributeNames(key);
    for (const attr of attrs) {
      if (typeof value === 'undefined' || value === null) {
        this.removeAttribute(attr);
      } else if (this.getAttribute(attr) !== value.toString()) {
        this.setAttribute(attr, value.toString());
      }
    }
  }

  private _flushValueToState(key: string, value: unknown) {
    const stateKey = sharedConfigKey(key as keyof ConfigType);
    if (this.$[stateKey] !== value) {
      if (typeof value === 'undefined' || value === null) {
        // For built-in configs, use initial value; for custom configs, keep undefined
        const defaultValue = initialConfig[key as keyof ConfigType];
        // @ts-expect-error
        this.$[stateKey] = defaultValue !== undefined ? defaultValue : value;
      } else {
        // @ts-expect-error
        this.$[stateKey] = value;
      }
    }
  }

  private _setValue(key: string, value: unknown) {
    // Normalize value (works for both built-in and custom configs)
    let normalizedValue: unknown;

    if (this._isCustomConfig(key)) {
      // For custom configs, try to get normalize function from plugin definition
      const config = this._getCustomConfigDefinition(key);
      normalizedValue = config?.normalize?.(value) ?? value;
    } else {
      // For built-in configs, use the standard normalization
      normalizedValue = normalizeConfigValue(key as keyof ConfigType, value);
    }

    // Perform the actual value setting
    const anyThis = this as any;
    const localPropName = getLocalPropName(key);

    if (anyThis[localPropName] === normalizedValue) return;

    this._assertSameValueDifferentReference(key, anyThis[localPropName], normalizedValue);

    anyThis[localPropName] = normalizedValue;

    // Flush the value to the state and attribute
    this._flushValueToAttribute(key, normalizedValue);
    this._flushValueToState(key, normalizedValue);

    this.debugPrint(`"${key}"`, normalizedValue);

    // Only run assertions for built-in configs
    if (!this._isCustomConfig(key)) {
      runAssertions(this.cfg);
    }
  }

  private _getValue(key: string) {
    const anyThis = this as any;
    const localPropName = getLocalPropName(key);
    return anyThis[localPropName] ?? this.$[sharedConfigKey(key as keyof ConfigType)];
  }

  private _assertSameValueDifferentReference(key: string, previousValue: unknown, nextValue: unknown) {
    if (this.cfg.debug) {
      if (
        nextValue !== previousValue &&
        typeof nextValue === 'object' &&
        typeof previousValue === 'object' &&
        JSON.stringify(nextValue) === JSON.stringify(previousValue)
      ) {
        console.warn(
          `[uc-config] Option "${key}" value is the same as the previous one but the reference is different`,
        );
        console.warn(
          `[uc-config] You should avoid changing the reference of the object to prevent unnecessary calculations`,
        );
        console.warn(`[uc-config] "${key}" previous value:`, previousValue);
        console.warn(`[uc-config] "${key}" new value:`, nextValue);
      }
    }
  }

  private _processCustomConfigs(pluginManager: PluginManager): void {
    const customConfigs = pluginManager.configRegistry.getAll();

    // Rebuild the custom attribute mapping
    this._customAttrKeyMapping = {};

    // Clean up subscriptions for configs that no longer exist
    for (const [name, unsub] of this._customConfigSubscriptions) {
      if (!customConfigs.has(name)) {
        unsub();
        this._customConfigSubscriptions.delete(name);
      }
    }

    for (const [name, definition] of customConfigs) {
      const configKey = name as keyof CustomConfig;
      const stateKey = sharedConfigKey(configKey as keyof ConfigType);

      // Build attribute name mappings (kebab-case and lowercase)
      // Add to mapping unless attribute is explicitly disabled (default is true)
      if (definition.attribute) {
        const attrNames = this._getAttributeNames(name);
        for (const attrName of attrNames) {
          this._customAttrKeyMapping[attrName] = name;
        }
      }

      // Set initial value in state if not already set
      if (!this.sharedCtx.has(stateKey)) {
        this.sharedCtx.add(stateKey, definition.defaultValue);
      }

      // Create property accessor if enabled (default true) and not already defined
      if (definition.accessor) {
        const descriptor = Object.getOwnPropertyDescriptor(this, name);
        if (!descriptor || !descriptor.set || !descriptor.get) {
          Object.defineProperty(this, name, {
            set: (value: unknown) => {
              // Use _setValue for consistent handling (normalization happens inside _setValue)
              this._setValue(name, value);
            },
            get: () => {
              // Use _getValue for consistent handling
              return this._getValue(name);
            },
            enumerable: true,
            configurable: true,
          });
        }
      }

      // Subscribe to state changes (only if not already subscribed)
      if (!this._customConfigSubscriptions.has(name)) {
        const unsub = this.sub(stateKey, (value) => {
          // Use _setValue for consistent handling (matches built-in config pattern)
          // The early return guard in _setValue prevents circular updates
          this._setValue(name, value);
        });
        this._customConfigSubscriptions.set(name, unsub);
      }
    }
  }

  private _setupCustomConfigs(): void {
    // Use when API to ensure pluginManager is available before setting up custom configs
    this._sharedInstancesBag.when('pluginManager', (pluginManager) => {
      // Initial setup
      this._processCustomConfigs(pluginManager);

      // Subscribe to plugin changes to reload custom configs dynamically
      this._pluginChangeUnsubscribe = pluginManager.onPluginsChange(() => {
        this._processCustomConfigs(pluginManager);
      });
    });
  }

  private _setupMutationObserver(): void {
    // Create a MutationObserver to detect dynamic attribute changes
    // This is specifically for custom config attributes that can't be
    // statically defined in observedAttributes. Built-in attributes are
    // already handled by the native attributeChangedCallback mechanism.
    this._mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName) {
          const attrName = mutation.attributeName;
          const oldValue = mutation.oldValue;
          const newValue = this.getAttribute(attrName);

          // Skip if value hasn't actually changed
          if (oldValue === newValue) continue;

          // Skip built-in config attributes - they're handled by observedAttributes
          const isBuiltInAttr = attrName in builtinAttrKeyMapping;
          if (isBuiltInAttr) continue;

          // Check if it's a custom plugin config attribute using the mapping
          if (attrName in this._customAttrKeyMapping) {
            // Call attributeChangedCallback for custom plugin attributes
            this.attributeChangedCallback(attrName, oldValue ?? '', newValue ?? '');
          }
        }
      }
    });

    // Start observing attribute changes
    this._mutationObserver.observe(this, {
      attributes: true,
      attributeOldValue: true,
    });
  }

  public override initCallback(): void {
    super.initCallback();
    const anyThis = this as any;

    // Setup custom configs first
    this._setupCustomConfigs();

    // Setup MutationObserver to detect dynamic attribute changes
    this._setupMutationObserver();

    // Subscribe to the state changes and update the local properties and attributes.
    // Initial callback call is disabled to prevent the initial value to be set here.
    // Initial value will be set below, skipping the default values.
    for (const key of plainConfigKeys) {
      this.sub(
        sharedConfigKey(key),
        (value) => {
          this._setValue(key, value);
        },
        false,
      );
    }

    for (const key of allConfigKeys) {
      // Flush the initial value to the state.
      // Initial value is taken from the DOM property if it was set before the element was initialized.
      // If no DOM property was set, the initial value is taken from the initialConfig.
      const initialValue = anyThis[key] ?? this.$[sharedConfigKey(key)];
      if (initialValue !== initialConfig[key]) {
        this._setValue(key, initialValue);
      }

      // Define DOM property setters and getters
      // They will be used in the userland directly or by the frameworks

      const descriptor = Object.getOwnPropertyDescriptor(this, key);
      if (!descriptor || !descriptor.set || !descriptor.get) {
        Object.defineProperty(this, key, {
          set: (value: unknown) => {
            this._setValue(key, value);
          },
          get: () => {
            return this._getValue(key);
          },
        });
      }
    }

    for (const key of allConfigKeys) {
      this.sub(sharedConfigKey(key), () => {
        computeProperty({
          key,
          setValue: this._setValue.bind(this),
          getValue: this._getValue.bind(this),
          computationControllers: this._computationControllers,
        });
      });
    }
  }

  public override attributeChangedCallback(name: string, oldVal: string, newVal: string) {
    super.attributeChangedCallback(name, oldVal, newVal);

    if (oldVal === newVal) return;

    const anyThis = this as any;
    const builtInKey = builtinAttrKeyMapping[name];

    // Handle built-in config attributes
    if (builtInKey) {
      // attributeChangedCallback could be called before the initCallback
      // so we set the DOM property instead of calling this._setValue.
      // If the block was initialized, the value will be handled by the setter.
      // If the block was not initialized, the value will be set to the DOM property
      // and handled on initialization.
      anyThis[builtInKey] = newVal;
    } else {
      // Handle custom config attributes (registered by plugins)
      // This runs asynchronously once pluginManager is available
      this._sharedInstancesBag.when('pluginManager', (pluginManager) => {
        const key = this._customAttrKeyMapping[name];
        const config = key ? pluginManager.configRegistry.get(key) : undefined;
        if (key && config) {
          // Use fromAttribute to deserialize the value if provided
          const val = config.fromAttribute ? config.fromAttribute(newVal) : newVal;
          // Use _setValue for consistent handling (normalization happens inside _setValue)
          this._setValue(key, val);
        }
      });
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();

    // Clean up plugin change subscription
    if (this._pluginChangeUnsubscribe) {
      this._pluginChangeUnsubscribe();
      this._pluginChangeUnsubscribe = undefined;
    }

    // Clean up MutationObserver
    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = undefined;
    }

    // Clean up all custom config subscriptions
    for (const unsub of this._customConfigSubscriptions.values()) {
      unsub();
    }
    this._customConfigSubscriptions.clear();
  }

  public static override get observedAttributes(): string[] {
    const superObserved = super.observedAttributes;
    const builtInAttrs = Object.keys(builtinAttrKeyMapping);

    // Note: Custom config attributes cannot be statically determined here
    // since they're registered at runtime. They're handled via mutation observer instead.
    return [...superObserved, ...builtInAttrs];
  }
}

/**
 * Define empty DOM properties for all config keys on the Custom Element class prototype to make them checkable using
 * `key in element` syntax. This is required for the frameworks DOM property bindings to work.
 */
for (const key of allConfigKeys) {
  (Config.prototype as any)[key] = undefined;
}

export interface Config extends ConfigType, CustomConfig {}

declare global {
  interface HTMLElementTagNameMap {
    'uc-config': Config;
  }
}
