// @ts-check
import { ConfigController } from '../../abstract/controllers/ConfigController';
import type { CustomConfig } from '../../abstract/customConfigOptions';
import type { ControllerContainer } from '../../abstract/di/ControllerContainer';
import { inject } from '../../abstract/di/inject';
import { PluginManagerBridge } from '../../abstract/di/PluginManagerBridge';
import { lazy } from '../../abstract/logger';
import type { PluginController } from '../../abstract/managers/plugin';
import type { ConfigComplexType, ConfigPlainType, ConfigType } from '../../types';
import { toKebabCase } from '../../utils/toKebabCase';
import { runAssertions } from './assertions';
import './config.css';
import { ChildBlock } from '../../lit/ChildBlock';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import { type ComputedPropertyControllers, computeProperty } from './computed-properties';
import { initialConfig } from './initialConfig';
import { normalizeConfigValue } from './normalizeConfigValue';

const allConfigKeys = [
  // "debug" option should go first to be able to print debug messages from the very beginning
  ...new Set(['debug', ...Object.keys(initialConfig)]),
] as Array<keyof ConfigType>;

/**
 * Render a config value for the change log with consistent quoting — strings
 * (incl. the empty string, which would otherwise be invisible) show quoted as
 * `""`, functions as `ƒ`, and everything else via `JSON.stringify`.
 */
const formatConfigLogValue = (value: unknown): string => {
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return 'ƒ';
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    // `String(value)` can ALSO throw (a throwing `Symbol.toPrimitive`/`toString`),
    // so guard it too — logging a config change must never surface an exception.
    try {
      return String(value);
    } catch {
      return '[unserializable]';
    }
  }
};

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
export class Config extends ChildBlock {
  // `<uc-config>` is the config WRITER: it resolves the ctx's `ConfigController`
  // via `this._config` and writes attribute/property values into it
  // (`set`/`setCustom`/`register`). This is the SAME instance the rest of the app
  // reads (v1's `this.uploader.config` resolved to `container.get(ConfigController)` too),
  // so writes land where every reader looks. The plugin manager (custom-config
  // registry) reads go through the editor-safe `PluginManagerBridge` DI token (see
  // `_getCustomConfigDefinition` / `_setupCustomConfigs`) rather than a direct
  // `use(PluginController)`, for two reasons, even though M-god step 8c made
  // `PluginController` container-owned: (1) `<uc-config>` runs in config-only ctxs
  // where no uploader scope ever binds `PluginController`, so the reads must stay
  // null-/absence-tolerant (`getOrNull`/`whenController` on an unbound token stay
  // inert, where a synchronous `use(PluginController)` would throw); and (2)
  // `<uc-config>` is in the editor-alone bundle, so a value import of
  // `PluginController` here would drag it (and `PluginRegistry`) into that bundle
  // and blow its 50 KB size-limit — the `declare`-only `PluginManagerBridge` keeps
  // it out while resolving to the SAME container instance (M-god step 9b-3).
  @inject(ConfigController) private readonly _config!: ConfigController;

  public declare attributesMeta: Partial<ConfigPlainType> & {
    'ctx-name': string;
  };

  private _computationControllers: ComputedPropertyControllers = new Map();
  private _pluginChangeUnsubscribe?: () => void;
  private _mutationObserver?: MutationObserver;

  /**
   * Mapping of attribute names to custom config keys for plugin-registered configs.
   * Updated dynamically when plugins are registered or changed.
   * Similar to builtinAttrKeyMapping but for custom configs.
   */
  private _customAttrKeyMapping: Record<string, string> = {};

  /** Set of all custom config names registered by plugins */
  private _customConfigKeys: Set<string> = new Set();

  /**
   * Map of custom config subscriptions (config name -> unsubscribe function)
   * Used to track and clean up subscriptions when plugins change
   */
  private _customConfigSubscriptions: Map<string, () => void> = new Map();

  /**
   * Check if a key is a custom config (registered by plugins)
   */
  private _isCustomConfig(key: string): boolean {
    return this._customConfigKeys.has(key);
  }

  /**
   * Get the custom config definition for a key
   */
  private _getCustomConfigDefinition(key: string) {
    // Read null-tolerantly via the `PluginManagerBridge` token: `getOrNull`
    // yields `null` when no uploader scope has bound the bridge (config-only /
    // plugin-less ctx) or when no container is adopted yet, instead of throwing.
    // This helper is reachable with a stale `_customConfigKeys`/
    // `_customAttrKeyMapping` — e.g. the MutationObserver forwards a custom
    // attribute during a live `ctx-name` switch, before `attributeChangedCallback`
    // reaches its own guard, or after a re-adoption into a ctx that has no plugin
    // manager. (`getOrNull` — not `useOrNull` — because the bridge is a
    // conditionally-bound token: a plain `get` on the unbound token would build a
    // bogus zero-arg instance.)
    const pluginManager = this.containerOrNull?.getOrNull(PluginManagerBridge)?.getPluginManager() ?? null;
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
    const isCustom = this._isCustomConfig(key);
    const configKey = key as keyof ConfigType;
    const currentValue = isCustom ? this._config.getCustom(key) : this._config.get(configKey);

    if (currentValue !== value) {
      if (typeof value === 'undefined' || value === null) {
        // For built-in configs, use initial value; for custom configs, keep undefined
        const defaultValue = initialConfig[configKey];
        const nextValue = defaultValue !== undefined ? defaultValue : value;
        if (isCustom) {
          this._config.setCustom(key, nextValue);
        } else {
          this._config.set(configKey, nextValue as ConfigType[typeof configKey]);
        }
      } else {
        if (isCustom) {
          this._config.setCustom(key, value);
        } else {
          this._config.set(configKey, value as ConfigType[typeof configKey]);
        }
      }
    }
  }

  private _setValue(key: string, value: unknown) {
    // Normalize value (works for both built-in and custom configs)
    let normalizedValue: unknown;

    if (this._isCustomConfig(key)) {
      // For custom configs, try to get normalize function from plugin definition
      const config = this._getCustomConfigDefinition(key);
      try {
        normalizedValue = config?.normalize?.(value) ?? value;
      } catch (error) {
        this._log.warn(`normalize() for "${key}" threw an error, keeping previous value`, error);
        return;
      }
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
    // NB: config-change logging is NOT done here — it's a separate observer on
    // `ConfigController` set up in `controllerReady` (`_setupChangeLog`), so it
    // catches every change (incl. non-block writers) decoupled from the setter.

    // Only run assertions for built-in configs
    if (!this._isCustomConfig(key)) {
      runAssertions(this._config.values);
    }
  }

  private _getValue(key: string) {
    const anyThis = this as any;
    const localPropName = getLocalPropName(key);
    return (
      anyThis[localPropName] ??
      (this._isCustomConfig(key) ? this._config.getCustom(key) : this._config.get(key as keyof ConfigType))
    );
  }

  private _assertSameValueDifferentReference(key: string, previousValue: unknown, nextValue: unknown) {
    if (this._config.values.debug) {
      if (
        nextValue !== previousValue &&
        typeof nextValue === 'object' &&
        typeof previousValue === 'object' &&
        JSON.stringify(nextValue) === JSON.stringify(previousValue)
      ) {
        this._log.warn(`Option "${key}" value is the same as the previous one but the reference is different`);
        this._log.warn(`You should avoid changing the reference of the object to prevent unnecessary calculations`);
        this._log.warn(`"${key}" previous value:`, previousValue);
        this._log.warn(`"${key}" new value:`, nextValue);
      }
    }
  }

  private _processCustomConfigs(pluginManager: PluginController): void {
    const customConfigs = pluginManager.configRegistry.getAll();

    // Rebuild the custom attribute mapping and names set
    this._customAttrKeyMapping = {};
    this._customConfigKeys = new Set(customConfigs.keys());

    // Clean up subscriptions for configs that no longer exist
    for (const [name, unsub] of this._customConfigSubscriptions) {
      if (!customConfigs.has(name)) {
        unsub();
        this._customConfigSubscriptions.delete(name);
      }
    }

    for (const [name, definition] of customConfigs) {
      // Build attribute name mappings (kebab-case and lowercase)
      // Add to mapping unless attribute is explicitly disabled (default is true)
      if (definition.attribute) {
        const attrNames = this._getAttributeNames(name);
        for (const attrName of attrNames) {
          this._customAttrKeyMapping[attrName] = name;
        }
      }

      let preExistingValue: unknown;
      let hasPreExistingValue = false;

      const existingDescriptor = Object.getOwnPropertyDescriptor(this, name);
      const isExistingDataDescriptor = !!existingDescriptor && !existingDescriptor.get && !existingDescriptor.set;
      if (isExistingDataDescriptor && existingDescriptor.value !== undefined) {
        preExistingValue = existingDescriptor.value;
        hasPreExistingValue = true;
      }

      if (!hasPreExistingValue && !!definition.attribute) {
        for (const attrName of this._getAttributeNames(name)) {
          const attrValue = this.getAttribute(attrName);
          if (attrValue !== undefined && attrValue !== null) {
            try {
              preExistingValue = definition.fromAttribute ? definition.fromAttribute(attrValue) : attrValue;
            } catch (error) {
              this._log.warn(`fromAttribute() for "${name}" threw an error, using raw attribute value`, error);
              preExistingValue = attrValue;
            }
            hasPreExistingValue = true;
            break;
          }
        }
      }

      // No separate state seeding here: `buildPluginApi`'s `registerConfig`
      // already seeded this key on the ctx's `ConfigController` (via
      // `ConfigController.register`) at plugin-setup time, before this
      // definition could ever appear in `configRegistry.getAll()`. The
      // registry lookup below is used only for adapter metadata (attribute
      // mapping, `fromAttribute`/`normalize`), not to re-seed state.

      // Create property accessor (getter/setter) if not already defined
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

      // Subscribe to state changes (only if not already subscribed)
      if (!this._customConfigSubscriptions.has(name)) {
        // Manual per-key dedup over the coarse `ConfigController.subscribe`
        // notification — same contract as v1's `this.sub(stateKey, cb, false)`
        // (init=false: no immediate call, only on subsequent changes).
        let lastValue = this._config.getCustom(name);
        const unsub = this._config.subscribe(() => {
          const nextValue = this._config.getCustom(name);
          if (!Object.is(nextValue, lastValue)) {
            lastValue = nextValue;
            // Use _setValue for consistent handling (matches built-in config pattern)
            // The early return guard in _setValue prevents circular updates
            this._setValue(name, nextValue);
          }
        });
        this._customConfigSubscriptions.set(name, unsub);
        this.addDisposer(unsub);
      }

      if (hasPreExistingValue) {
        this._setValue(name, preExistingValue);
        // Same re-adoption hazard as the built-in `allConfigKeys` loop above:
        // force the flush through in case `_setValue`'s local-cache dedup
        // no-op'd against a value already cached from a previous ctx.
        this._flushValueToState(name, this._getValue(name));
      }
    }
  }

  /**
   * Change-log observer (verbose/debug-gated): logs every `ConfigController`
   * change as `key: <old> → <new>` — decoupled from the setter and covering
   * ALL writers (this block, `api`, plugin `registerConfig`), not just
   * `_setValue`. Recovers the per-key old/new by diffing a snapshot over the
   * coarse `subscribe` notify (same pattern as the per-key sync subscriptions).
   * Seeded before the initial-value flush so startup sets are logged; re-seeded
   * per adoption and torn down via `addDisposer`.
   */
  private _setupChangeLog(): void {
    let snapshot: Record<string, unknown> = { ...this._config.values };
    this.addDisposer(
      this._config.subscribe(() => {
        const next = this._config.values as Record<string, unknown>;
        for (const key of Object.keys(next)) {
          const prev = snapshot[key];
          const curr = next[key];
          if (!Object.is(curr, prev)) {
            // Thunked so the `formatConfigLogValue` (JSON.stringify) only runs
            // when debug is on. Values are quoted for consistency and so an
            // empty string is visible as `""`.
            this._log.debug(lazy(() => [`${key}: ${formatConfigLogValue(prev)} → ${formatConfigLogValue(curr)}`]));
          }
        }
        snapshot = { ...next };
      }),
    );
  }

  private _setupCustomConfigs(): void {
    // Wait for the plugin manager via the `PluginManagerBridge` token: fires
    // synchronously if the bridge is already resolved (uploader scope attached),
    // else on the `ensurePluginManager` `get` that constructs it. When it isn't
    // resolved yet, `whenController` returns a real unsubscriber — track it so a
    // re-adoption (ctx-name switch) tears down the previous ctx's pending waiter
    // instead of leaving it to fire against the wrong controller. (A synchronous
    // resolve returns a no-op unsub; tracking it is harmless.) In an editor-alone
    // ctx the bridge is never bound, so this stays inert (no plugins standalone).
    this.addDisposer(
      this.container.whenController(PluginManagerBridge, (bridge) => {
        const pluginManager = bridge.getPluginManager();
        // Initial setup
        this._processCustomConfigs(pluginManager);

        // Subscribe to plugin changes to reload custom configs dynamically
        this._pluginChangeUnsubscribe = pluginManager.onPluginsChange(() => {
          this._processCustomConfigs(pluginManager);
        });
      }),
    );
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
            const key = this._customAttrKeyMapping[attrName] as string;
            const config = this._getCustomConfigDefinition(key);

            // Call attributeChangedCallback for custom plugin attributes
            this.attributeChangedCallback(attrName, oldValue ?? '', newValue ?? config?.defaultValue ?? '');
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

  /**
   * Fires on every controller adoption — the initial one and any re-adoption
   * (ctx-name switch, or ctx death + re-adopt on a v1-managed ctx). All
   * subscriptions below route through `addDisposer` (or the manual
   * `ConfigController.subscribe` + dedup, tracked the same way) so a
   * re-adoption tears the previous cycle's subscriptions down instead of
   * stacking a second set on top. The plugin-change listener and the
   * MutationObserver are host/DOM-level and not covered by `addDisposer` — see
   * the teardown-before-resubscribe below and the idempotent guard,
   * respectively.
   */
  protected override controllerReady(_container: ControllerContainer): void {
    const anyThis = this as any;

    // Setup custom configs first. Tear down the previous cycle's
    // plugin-change subscription before resubscribing — otherwise a
    // re-adoption would stack a second `onPluginsChange` listener on top of
    // one still bound to the previously-adopted controller's plugin manager
    // (mirrors `UploadCtxProvider`'s `EventBridgeController` teardown-first
    // pattern for the same re-adoption hazard).
    if (this._pluginChangeUnsubscribe) {
      this._pluginChangeUnsubscribe();
      this._pluginChangeUnsubscribe = undefined;
    }
    this._setupCustomConfigs();

    // Setup MutationObserver to detect dynamic attribute changes. This
    // observes the DOM node itself, not the controller/ctx, so it must only
    // be created once per element lifetime — re-adoption must not stack a
    // second observer on the same node.
    if (!this._mutationObserver) {
      this._setupMutationObserver();
    }

    // Change-log observer — set up BEFORE the initial-value flush below so the
    // startup config values are logged too. Verbose/debug-gated.
    this._setupChangeLog();

    for (const key of allConfigKeys) {
      // Flush the initial value to the state.
      // Initial value is taken from the DOM property if it was set before the element was initialized.
      // If no DOM property was set, the initial value is taken from the initialConfig.
      const initialValue = anyThis[key] ?? this._config.get(key);
      if (initialValue !== initialConfig[key]) {
        this._setValue(key, initialValue);
        // `_setValue`'s no-op guard (skip when the local property cache
        // already equals the normalized value) exists to avoid redundant
        // local writes — it must not also skip seeding a *freshly-adopted*
        // controller's state on re-adoption (ctx-name switch), whose
        // `ConfigController` starts from `initialConfig` regardless of what
        // this element's local cache already holds. Force the flush using
        // the now-current (possibly already-cached) normalized value.
        this._flushValueToState(key, anyThis[getLocalPropName(key)]);
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
  }

  // Sync each plain (attribute-representable) config key into the local property
  // on change. Per-key `ConfigController.observe` (atomic dedup) replaces the
  // coarse `subscribe` + manual `Object.is` loop; change-only (no eager) — the
  // initial values are seeded by the `allConfigKeys` flush in `controllerReady`.
  @subscription()
  protected _wirePlainConfigSync(): Unsubscribe[] {
    return plainConfigKeys.map((key) => this._config.observe(key, (value) => this._setValue(key, value)));
  }

  // Computed properties (`cdnCname`, `cameraModes`, …) recompute from their
  // dependency config keys. Per-key `ConfigController.observe` reproduces the
  // former per-key `subConfigValue` (dedup, no unrelated-key re-fire); the eager
  // pass computes the initial value. Composed into one teardown, auto-disposed.
  @subscription()
  protected _wireComputedProperties(): Unsubscribe[] {
    const runComputeProperty = (key: keyof ConfigType) => {
      computeProperty({
        key,
        setValue: this._setValue.bind(this),
        getValue: this._getValue.bind(this),
        computationControllers: this._computationControllers,
      });
    };
    return allConfigKeys.map((key) => this._config.observe(key, () => runComputeProperty(key), { immediate: true }));
  }

  /**
   * Release counterpart of `controllerReady` (disconnect, or a scope switch
   * that drops the controller ahead of a re-adopt). Tears down the
   * plugin-change subscription (idempotent — already-cleared is a no-op) and
   * clears the custom-config bookkeeping so a subsequent `controllerReady`
   * (re-adoption onto a different ctx) starts subscribing fresh instead of
   * skipping names it thinks are already subscribed on a now-defunct
   * controller's `ConfigController`. The `addDisposer`-registered subscriptions
   * themselves are already torn down by `ChildBlock._releaseController`
   * before this hook runs.
   */
  protected override controllerReleased(): void {
    if (this._pluginChangeUnsubscribe) {
      this._pluginChangeUnsubscribe();
      this._pluginChangeUnsubscribe = undefined;
    }
    this._customConfigSubscriptions.clear();
  }

  public override attributeChangedCallback(name: string, oldVal: string, newVal: string) {
    super.attributeChangedCallback(name, oldVal, newVal);

    if (oldVal === newVal) return;

    const anyThis = this as any;
    const builtInKey = builtinAttrKeyMapping[name];

    // Handle built-in config attributes
    if (builtInKey) {
      // attributeChangedCallback could be called before the controller is adopted
      // so we set the DOM property instead of calling this._setValue.
      // If the block was initialized, the value will be handled by the setter.
      // If the block was not initialized, the value will be set to the DOM property
      // and handled on initialization.
      anyThis[builtInKey] = newVal;
    } else {
      // Handle custom config attributes (registered by plugins).
      //
      // `attributeChangedCallback` can fire before this element has adopted a
      // container — during custom-element upgrade (no ctx yet), OR on a live
      // `ctx-name` switch (the previous container was released and the new one
      // isn't adopted yet). Guard on `containerOrNull` (never throws) and defer
      // when it's null: the value is on the DOM attribute and `controllerReady`
      // → `_setupCustomConfigs` → `_processCustomConfigs` reads pre-existing
      // attribute values on adoption (matching v1's deferral). The bridge waiter
      // then resolves the plugin manager now-or-when-available.
      const container = this.containerOrNull;
      if (!container) {
        return;
      }
      container.whenController(PluginManagerBridge, (bridge) => {
        const pluginManager = bridge.getPluginManager();
        const currentAttrValue = this.getAttribute(name);
        if (currentAttrValue && currentAttrValue !== newVal) {
          return;
        }
        const key = this._customAttrKeyMapping[name];
        const config = key ? pluginManager.configRegistry.get(key) : undefined;
        if (key && config) {
          // Use fromAttribute to deserialize the value if provided
          const val = config.fromAttribute ? config.fromAttribute(newVal) : newVal;
          if (this._getValue(key) === val) return;
          // Use _setValue for consistent handling (normalization happens inside _setValue)
          this._setValue(key, val);
        }
      });
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();

    // Clean up plugin change subscription (already cleared in most cases by
    // `controllerReleased`, above — this is a defensive no-op then).
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
