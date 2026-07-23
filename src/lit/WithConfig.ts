import type { ConfigKeyDescriptor } from '../abstract/config-descriptor';
import { ConfigController } from '../abstract/controllers/ConfigController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { inject } from '../abstract/di/inject';
import { lazy } from '../abstract/logger';
import { runAssertions } from '../blocks/Config/assertions';
import { BUILTIN_DESCRIPTORS } from '../blocks/Config/builtin-descriptors';
import {
  type ComputedPropertyControllers,
  type ConfigGetter,
  type ConfigSetter,
  computedPropertyDependencyKeys,
  computeProperty,
} from '../blocks/Config/computed-properties';
import { allConfigKeys, builtinAttrKeyMapping, plainConfigKeys } from '../blocks/Config/config-keys';
import { initialConfig } from '../blocks/Config/initialConfig';
import type { ConfigType } from '../types';
import { toKebabCase } from '../utils/toKebabCase';
import type { ChildBlock } from './ChildBlock';
import type { Constructor } from './Constructor';
import type { ConfigHost } from './config-host-types';
import { subscription, type Unsubscribe } from './subscription';

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

const toComparableJson = (value: unknown): string | undefined => {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
};

// The attribute names (kebab-case + lowercase, deduped) a config key maps to.
// Cached module-wide: the names are a pure function of the key string, shared
// across all config hosts, and read on every attribute flush — so this replaces
// a `new Set([...])` allocation per call with a single computed tuple per key.
const attributeNamesCache = new Map<string, readonly string[]>();
const getConfigAttributeNames = (key: string): readonly string[] => {
  const cached = attributeNamesCache.get(key);
  if (cached) return cached;
  const kebab = toKebabCase(key);
  const lower = key.toLowerCase();
  const names = kebab === lower ? [kebab] : [kebab, lower];
  attributeNamesCache.set(key, names);
  return names;
};

/**
 * Makes its `Base` block a **config host**: the element↔`ConfigController`
 * adapter that used to live only on `<uc-config>`, now reusable on any
 * `ChildBlock`. The host reads/writes attributes and DOM properties for every
 * built-in config option (and dynamic plugin-registered custom configs) into the
 * ctx's `ConfigController` — the SAME instance the rest of the app reads — and
 * reflects external controller changes back onto its attributes/properties.
 *
 * It is class-level (not a bare reactive controller) so it can contribute the
 * auto-inferred config type surface (`ConfigHost`, derived from `ConfigType`)
 * and the property accessors onto the host's own type and prototype. `this`
 * stays the element throughout — behavior is identical to the previous
 * `<uc-config>` implementation.
 *
 * Attribute reactivity avoids claiming `observedAttributes` /
 * `attributeChangedCallback` so subclasses keep Lit's normal `@property`
 * mapping (e.g. a host's own `mode` attribute). Instead:
 *
 * 1. **`setAttribute` / `removeAttribute` overrides** — sync path for
 *    programmatic changes (CKEditor-style `setAttribute` then immediate
 *    `api.initFlow()`), and pre-adoption property stash so
 *    `el.pubkey` is readable after `setAttribute('pubkey', …)` before connect.
 * 2. **MutationObserver** — backup for any attr mutation that bypasses those
 *    methods, and for custom keys whose mapping appears after the attr is set.
 *
 * It knows NOTHING about plugins or a "custom vs built-in" split: every key —
 * built-in or plugin-registered — is described by a {@link ConfigKeyDescriptor}
 * read from `ConfigController.descriptor()`, and dynamic keys arrive via
 * `ConfigController.onSchemaChange`. Plugins are just callers of
 * `ConfigController.register`; the config layer has no `PluginManagerBridge`
 * dependency, which also keeps `PluginController` out of the editor-alone bundle.
 */
export function WithConfig<T extends abstract new (...args: any[]) => ChildBlock>(
  Base: T,
): T & Constructor<ConfigHost> {
  abstract class WithConfigClass extends Base {
    // Resolves the ctx's `ConfigController` via the container this block adopted
    // (tagged as `this[CONTAINER]`), yielding the very same controller instance
    // the ctx owns — writes land where every reader looks.
    @inject(ConfigController) private readonly _config!: ConfigController;

    private _computationControllers: ComputedPropertyControllers = new Map();
    private _mutationObserver?: MutationObserver;
    // Suppresses setAttribute/removeAttribute → config re-apply while we are
    // reflecting a property/state value out to the DOM. Without this,
    // `_setValue` → `_flushValueToAttribute` → `setAttribute` → fromAttribute
    // re-parse loops (custom `fromAttribute` prefixes, stack overflow on seed).
    private _suppressAttrSync = false;
    // Local cache backing the per-key DOM property accessors — the "last value
    // this element wrote/read", used to dedupe redundant writes. Deliberately
    // survives `controllerReleased` (a re-adoption re-seeds against it), so it is
    // NOT cleared there. Replaces the former `__${key}` own-props + `as any`.
    private readonly _localValues = new Map<string, unknown>();
    // Built-in accessors are installed once per element lifetime (they're own,
    // non-configurable, and never removed) — this skips re-checking all ~55 keys
    // on every re-adoption.
    private _builtInAccessorsInstalled = false;
    // The ctx's `ConfigController` captured at adoption. Used to deregister the
    // writer in `controllerReleased` and inside the deferred multi-writer check,
    // both of which run AFTER `_releaseController` clears `this[CONTAINER]` — so
    // the `@inject _config` getter would throw there. The captured reference is
    // the exact instance the writer registered on; `unregisterWriter` on an
    // already-destroyed controller is a harmless no-op.
    private _writerConfig?: ConfigController;

    // Attribute-name → dynamic (custom) key map, rebuilt from the controller's
    // descriptors on every schema change. Built-in attr names live in the static
    // `builtinAttrKeyMapping`; this only holds the dynamic ones.
    private _customAttrKeyMapping: Record<string, string> = {};

    // Dynamic-key state subscriptions (key → unsubscribe), so a schema change can
    // tear down subscriptions for keys that went away.
    private _customConfigSubscriptions: Map<string, () => void> = new Map();

    /**
     * Install the DOM property accessor (getter/setter → `_getValue`/`_setValue`)
     * for a config key, unless one already exists. Built-in keys use the default
     * (non-enumerable, non-configurable) descriptor; custom keys pass
     * `{ enumerable: true, configurable: true }` — these flags are observable, so
     * they must stay distinct between the two callers.
     */
    private _installPropertyAccessor(
      key: string,
      options: { enumerable?: boolean; configurable?: boolean } = {},
    ): void {
      const descriptor = Object.getOwnPropertyDescriptor(this, key);
      if (descriptor?.get && descriptor?.set) return;
      Object.defineProperty(this, key, {
        get: () => this._getValue(key),
        set: (value: unknown) => this._setValue(key, value),
        enumerable: options.enumerable ?? false,
        configurable: options.configurable ?? false,
      });
    }

    private _flushValueToAttribute(key: string, descriptor: ConfigKeyDescriptor, value: unknown) {
      // Complex keys + `attribute: false` custom keys don't reflect to attributes.
      if (!descriptor.attribute) {
        return;
      }
      // Serialize once via the descriptor (null ⇒ remove the attribute) — wire
      // format is identical to the previous `String(value)` behavior.
      const serialized = descriptor.toAttribute(value);
      // Own-flush only updates the DOM — do not re-enter attr→config sync
      // (would re-run fromAttribute on the just-serialized string).
      this._suppressAttrSync = true;
      try {
        for (const attr of getConfigAttributeNames(key)) {
          if (serialized === null) {
            this.removeAttribute(attr);
          } else if (this.getAttribute(attr) !== serialized) {
            this.setAttribute(attr, serialized);
          }
        }
      } finally {
        this._suppressAttrSync = false;
      }
    }

    private _flushValueToState(key: string, value: unknown) {
      const current = this._config.get(key);
      if (current === value) {
        return;
      }
      if (value === undefined || value === null) {
        // Reset semantics: a built-in key falls back to its `initialConfig`
        // default; a custom key (absent from `initialConfig`) clears to the value
        // itself (i.e. undefined/null) — preserved exactly from the pre-descriptor
        // behavior. NB: uses `initialConfig`, NOT `descriptor.defaultValue`, so a
        // custom key clears rather than resetting to its registered default.
        const dflt = initialConfig[key as keyof ConfigType];
        this._config.set(key, dflt !== undefined ? dflt : value);
      } else {
        this._config.set(key, value);
      }
    }

    private _setValue(key: string, value: unknown) {
      const descriptor = this._config.descriptor(key);
      if (!descriptor) {
        return; // unknown key — ignore (custom keys arrive via the schema signal)
      }

      // Normalize (built-in normalizers can't throw — they catch internally; a
      // custom `normalize` may, so keep the previous value on throw).
      let normalizedValue: unknown;
      try {
        normalizedValue = descriptor.normalize(value);
      } catch (error) {
        this._log.warn(`normalize() for "${key}" threw an error, keeping previous value`, error);
        return;
      }

      const previous = this._localValues.get(key);
      if (previous === normalizedValue) return;

      this._assertSameValueDifferentReference(key, previous, normalizedValue);
      this._localValues.set(key, normalizedValue);

      // Flush the value to the attribute and state.
      this._flushValueToAttribute(key, descriptor, normalizedValue);
      this._flushValueToState(key, normalizedValue);
      // NB: config-change logging is NOT done here — it's a separate observer on
      // `ConfigController` set up in `controllerReady` (`_setupChangeLog`), so it
      // catches every change (incl. non-block writers) decoupled from the setter.

      // Assertions run for built-in configs only (validate the global config shape).
      if (BUILTIN_DESCRIPTORS.has(key)) {
        runAssertions(this._config.values);
      }
    }

    private _getValue(key: string) {
      const local = this._localValues.get(key);
      return local ?? this._config.get(key);
    }

    private _assertSameValueDifferentReference(key: string, previousValue: unknown, nextValue: unknown) {
      // Copilot-hardened: toComparableJson swallows circular/throwing values so a
      // debug-only compare never surfaces from `_setValue`.
      if (this._config.values.debug) {
        const nextSerialized = toComparableJson(nextValue);
        const previousSerialized = toComparableJson(previousValue);
        if (
          nextValue !== previousValue &&
          typeof nextValue === 'object' &&
          typeof previousValue === 'object' &&
          nextSerialized !== undefined &&
          nextSerialized === previousSerialized
        ) {
          this._log.warn(`Option "${key}" value is the same as the previous one but the reference is different`);
          this._log.warn(`You should avoid changing the reference of the object to prevent unnecessary calculations`);
          this._log.warn(`"${key}" previous value:`, previousValue);
          this._log.warn(`"${key}" new value:`, nextValue);
        }
      }
    }

    /**
     * Resolve a custom config's pre-existing value on (re-)adoption: a DOM data
     * property set before the plugin registered (framework binding) wins;
     * otherwise a pre-existing attribute, deserialized via the definition's
     * `fromAttribute` (raw value if it throws). Returns `{ has: false }` when
     * neither is present.
     */
    private _readPreExistingCustomValue(descriptor: ConfigKeyDescriptor): { has: boolean; value: unknown } {
      const name = descriptor.name;
      const existingDescriptor = Object.getOwnPropertyDescriptor(this, name);
      const isDataProperty = !!existingDescriptor && !existingDescriptor.get && !existingDescriptor.set;
      if (isDataProperty && existingDescriptor.value !== undefined) {
        return { has: true, value: existingDescriptor.value };
      }

      if (descriptor.attribute) {
        for (const attrName of getConfigAttributeNames(name)) {
          const attrValue = this.getAttribute(attrName);
          if (attrValue !== undefined && attrValue !== null) {
            try {
              return { has: true, value: descriptor.fromAttribute(attrValue) };
            } catch (error) {
              this._log.warn(`fromAttribute() for "${name}" threw an error, using raw attribute value`, error);
              return { has: true, value: attrValue };
            }
          }
        }
      }

      return { has: false, value: undefined };
    }

    // Sync the element's dynamic (custom) config wiring to the controller's
    // current descriptor set — the attribute map, property accessors, and per-key
    // subscriptions. Runs on adoption and on every schema change (a key
    // registered/unregistered), so no plugin-manager coupling remains.
    private _syncCustomConfigs(): void {
      const descriptors = this._config.getCustomDescriptors();
      const currentNames = new Set(descriptors.map((d) => d.name));

      // Rebuild the custom attribute → key map from scratch.
      this._customAttrKeyMapping = {};

      // Drop subscriptions for keys that no longer exist.
      for (const [name, unsub] of this._customConfigSubscriptions) {
        if (!currentNames.has(name)) {
          unsub();
          this._customConfigSubscriptions.delete(name);
        }
      }

      for (const descriptor of descriptors) {
        const name = descriptor.name;
        if (descriptor.attribute) {
          for (const attrName of getConfigAttributeNames(name)) {
            this._customAttrKeyMapping[attrName] = name;
          }
        }

        // Read any pre-existing value BEFORE installing the accessor —
        // `_installPropertyAccessor` overwrites a pre-upgrade data property with
        // the getter/setter, which would otherwise destroy that value first.
        // (State value was already seeded by `ConfigController.register`.)
        const preExisting = this._readPreExistingCustomValue(descriptor);

        // Custom accessors are enumerable + configurable (distinct from built-ins).
        this._installPropertyAccessor(name, { enumerable: true, configurable: true });

        // Subscribe to state changes (once) — atomic per-key observe, change-only
        // (no immediate). `_setValue`'s early-return guard prevents circular updates.
        if (!this._customConfigSubscriptions.has(name)) {
          const unsub = this._config.observe(name, (nextValue) => this._setValue(name, nextValue));
          this._customConfigSubscriptions.set(name, unsub);
          this.addDisposer(unsub);
        }

        if (preExisting.has) {
          this._setValue(name, preExisting.value);
          // Same re-adoption hazard as the built-in seed loop: force the flush in
          // case `_setValue`'s local-cache dedup no-op'd against a value already
          // cached from a previous ctx.
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

    private _setupSchemaSync(): void {
      // Sync dynamic config wiring now (picks up any keys already registered) and
      // on every subsequent schema change. The controller owns the descriptor set,
      // so this is plugin-agnostic — no `PluginManagerBridge`/`onPluginsChange`.
      // `addDisposer`'d so a re-adoption tears the listener down and re-syncs fresh.
      this._syncCustomConfigs();
      this.addDisposer(this._config.onSchemaChange(() => this._syncCustomConfigs()));
    }

    /**
     * Apply a live DOM attribute change for a config key (built-in or custom).
     * Always re-reads `getAttribute` so batched/stale MutationObserver deliveries
     * cannot write a superseded value. No-ops when the host is not adopted
     * (attr changes during release are ignored; seed re-reads on next adopt).
     */
    private _applyConfigAttributeChange(attrName: string): void {
      if (!this.containerOrNull) return;

      const builtInKey = builtinAttrKeyMapping[attrName];
      if (builtInKey) {
        const current = this.getAttribute(attrName);
        // Removal → undefined → `_flushValueToState` resets to initialConfig.
        // Present → raw attr string; the property setter / `_setValue` normalizes.
        this._setValue(builtInKey, current === null ? undefined : current);
        return;
      }

      const key = this._customAttrKeyMapping[attrName];
      const descriptor = key ? this._config.descriptor(key) : undefined;
      if (!key || !descriptor) return;

      const currentAttrValue = this.getAttribute(attrName);
      // Attribute removed → restore the registered default WITHOUT `fromAttribute`
      // (defaultValue may be a non-string; fromAttribute is the string pre-parse).
      if (currentAttrValue === null) {
        this._setValue(key, descriptor.defaultValue);
        return;
      }
      const val = descriptor.fromAttribute(currentAttrValue);
      if (this._getValue(key) === val) return;
      this._setValue(key, val);
    }

    /**
     * Sync path after `setAttribute` / `removeAttribute` (and MO backup):
     * - **Built-in, pre-adoption:** stash the raw attr string (or `undefined` on
     *   remove) as an own data property via `Reflect.set`, matching the old
     *   `attributeChangedCallback` contract so `el.pubkey` is readable before
     *   connect and seed can prefer the data property.
     * - **Built-in, post-adoption:** `_applyConfigAttributeChange` (or
     *   `Reflect.set` through the installed accessor — same `_setValue` path).
     * - **Custom:** only when adopted and mapped; unmapped/pre-adoption custom
     *   attrs stay on the DOM for `_syncCustomConfigs` to pick up later.
     */
    private _syncConfigAttributeFromDom(attrName: string): void {
      const builtInKey = builtinAttrKeyMapping[attrName];
      if (builtInKey) {
        if (this.containerOrNull) {
          this._applyConfigAttributeChange(attrName);
        } else {
          const current = this.getAttribute(attrName);
          // Same pre-adoption stash the previous ACC used: raw string or undefined.
          Reflect.set(this, builtInKey, current === null ? undefined : current);
        }
        return;
      }

      if (this.containerOrNull && attrName in this._customAttrKeyMapping) {
        this._applyConfigAttributeChange(attrName);
      }
    }

    /**
     * Programmatic attribute writes must update config **synchronously** —
     * MutationObserver delivers later (microtask), which races
     * `setAttribute('source-list', …); api.initFlow()`. Non-config attrs pass
     * through untouched so Lit subclass properties stay free.
     */
    public override setAttribute(qualifiedName: string, value: string): void {
      super.setAttribute(qualifiedName, value);
      if (!this._suppressAttrSync) {
        this._syncConfigAttributeFromDom(qualifiedName);
      }
    }

    public override removeAttribute(qualifiedName: string): void {
      super.removeAttribute(qualifiedName);
      if (!this._suppressAttrSync) {
        this._syncConfigAttributeFromDom(qualifiedName);
      }
    }

    private _ensureMutationObserver(): void {
      // Observes the DOM node itself (not the controller/ctx), so it must be
      // created only ONCE per element lifetime — re-adoption must not stack a
      // second observer on the same node.
      if (this._mutationObserver) return;

      // Backup for attr mutations that bypass setAttribute/removeAttribute.
      // Primary sync path is those overrides; we still do not claim
      // `observedAttributes` so Lit subclass `@property` mapping stays free.
      this._mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type !== 'attributes' || !mutation.attributeName) continue;
          const attrName = mutation.attributeName;
          // Cheap no-op when the attr didn't actually change (set to same value).
          if (mutation.oldValue === this.getAttribute(attrName)) continue;
          // Only react to config attrs (built-in mapping or dynamic custom map).
          if (attrName in builtinAttrKeyMapping || attrName in this._customAttrKeyMapping) {
            this._applyConfigAttributeChange(attrName);
          }
        }
      });

      this._mutationObserver.observe(this, {
        attributes: true,
        attributeOldValue: true,
      });
    }

    // Register as this ctx's config writer + warn (deferred) if another host is
    // already writing config here (one config host per ctx is the contract).
    // Capture the controller so release/microtask paths don't hit the
    // post-CONTAINER-clear `@inject` throw.
    private _registerAsConfigWriter(): void {
      const config = this._config;
      config.registerWriter(this);
      this._writerConfig = config;
      this._maybeWarnMultipleWriters(config);
    }

    /**
     * Read a built-in key's pre-existing attribute (if any). Used at seed time
     * for HTML-parsed attrs and any pre-connect write that left the attr on
     * the element without an own data property stash.
     */
    private _readBuiltInAttribute(key: string): { has: boolean; value: unknown } {
      const descriptor = this._config.descriptor(key);
      if (!descriptor?.attribute) return { has: false, value: undefined };
      for (const attrName of getConfigAttributeNames(key)) {
        if (!this.hasAttribute(attrName)) continue;
        const raw = this.getAttribute(attrName) as string;
        try {
          return { has: true, value: descriptor.fromAttribute(raw) };
        } catch (error) {
          this._log.warn(`fromAttribute() for "${key}" threw an error, using raw attribute value`, error);
          return { has: true, value: raw };
        }
      }
      return { has: false, value: undefined };
    }

    // Seed built-in config from the DOM on every adoption, then install the DOM
    // property accessors once. The seed runs every time (a re-adopted ctx starts
    // from `initialConfig` and must be re-seeded); the accessor install is
    // one-shot (see `_builtInAccessorsInstalled`).
    private _seedBuiltInConfig(): void {
      // First adoption installs the accessors; re-adoption skips it (they're own,
      // non-configurable, never removed) — a per-element-lifetime optimization.
      const installAccessors = !this._builtInAccessorsInstalled;

      for (const key of allConfigKeys) {
        // Priority: pre-upgrade own data property (framework binding) → live
        // attribute (HTML / setAttribute before adopt) → existing prop / controller.
        const own = Object.getOwnPropertyDescriptor(this, key);
        const isDataProperty = !!own && !own.get && !own.set && own.value !== undefined;
        const fromAttr = isDataProperty ? { has: false, value: undefined } : this._readBuiltInAttribute(key);
        const initialValue = isDataProperty
          ? own.value
          : fromAttr.has
            ? fromAttr.value
            : (Reflect.get(this, key) ?? this._config.get(key));

        if (initialValue !== initialConfig[key]) {
          this._setValue(key, initialValue);
          // `_setValue`'s no-op guard (skip when the local cache already equals
          // the normalized value) must not skip seeding a freshly-adopted
          // controller on re-adoption (ctx-name switch), whose `ConfigController`
          // starts from `initialConfig` regardless of the cache. Force the flush.
          this._flushValueToState(key, this._localValues.get(key));
        }

        // Install this key's accessor RIGHT AFTER seeding it (used directly in
        // userland or by framework property bindings) — interleaved so a
        // synchronous config subscriber reading an already-seeded key's DOM
        // property during this loop hits its getter, not the prototype stub.
        if (installAccessors) {
          this._installPropertyAccessor(key);
        }
      }

      this._builtInAccessorsInstalled = true;
    }

    /**
     * Fires on every controller adoption — the initial one and any re-adoption
     * (ctx-name switch, or ctx death + re-adopt on a v1-managed ctx). The step
     * ORDER is load-bearing: writer registration → custom configs → mutation
     * observer (backup for non-setAttribute paths) → change-log (BEFORE the
     * seed, so startup values are logged) → built-in seed (reads pre-existing
     * attributes / data-property stash from pre-connect `setAttribute`). Every
     * subscription these open routes through `addDisposer`, so a re-adoption
     * tears the previous cycle down instead of stacking a second set; the
     * MutationObserver is host-level and guarded by an idempotency flag (not
     * torn down on release).
     */
    protected override controllerReady(container: ControllerContainer): void {
      // Call super first so composable inner mixins (e.g. {@link WithApi}) still
      // run their adoption setup when stacked as `WithConfig(WithApi(ChildBlock))`.
      super.controllerReady(container);
      this._registerAsConfigWriter();
      this._setupSchemaSync();
      this._ensureMutationObserver();
      this._setupChangeLog();
      this._seedBuiltInConfig();
    }

    // Sync each plain (attribute-representable) config key into the local property
    // on change. Per-key `ConfigController.observe` (atomic dedup) replaces the
    // coarse `subscribe` + manual `Object.is` loop; change-only (no eager) — the
    // initial values are seeded by `_seedBuiltInConfig` in `controllerReady`.
    @subscription()
    protected _wirePlainConfigSync(): Unsubscribe[] {
      return plainConfigKeys.map((key) => this._config.observe(key, (value) => this._setValue(key, value)));
    }

    // Computed properties (`cdnCname`, `cameraModes`, …) recompute from their
    // dependency config keys. `computeProperty(key)` is a no-op unless `key` feeds
    // a computed, so we observe ONLY the computed dependency keys (~4) rather than
    // all ~55 — filtered through `allConfigKeys` to preserve the exact initial
    // (`immediate`) compute ORDER the all-keys loop had (the two `cameraModes`
    // computeds both read+write `cameraModes`, so order is observable). Composed
    // into one teardown, auto-disposed.
    @subscription()
    protected _wireComputedProperties(): Unsubscribe[] {
      // `_setValue`/`_getValue` are string-keyed and untyped-value (they bridge
      // the dynamic DOM surface); cast once to the key-typed contract computeProperty expects.
      const setValue = this._setValue.bind(this) as ConfigSetter;
      const getValue = this._getValue.bind(this) as ConfigGetter;
      const runComputeProperty = (key: keyof ConfigType) => {
        computeProperty({ key, setValue, getValue, computationControllers: this._computationControllers });
      };
      return allConfigKeys
        .filter((key) => computedPropertyDependencyKeys.has(key))
        .map((key) => this._config.observe(key, () => runComputeProperty(key), { immediate: true }));
    }

    /**
     * Deferred-confirm warning: one config host per ctx is the contract. On a
     * register-time conflict, re-check on a microtask and warn only if ≥2 hosts
     * are still registered AND connected — so a normal host swap (remove-then-add,
     * reorder), where the outgoing host deregisters a tick later, stays silent.
     */
    private _maybeWarnMultipleWriters(config: ConfigController): void {
      if (config.getWriters().length <= 1) return;
      queueMicrotask(() => {
        const live = config.getWriters().filter((w) => w.isConnected);
        if (live.length > 1 && live.includes(this)) {
          this._log.warn(
            `multiple config writers in ctx "${this.containerOrNull?.ctxName ?? '?'}" — only one config host should exist per ctx`,
          );
        }
      });
    }

    /**
     * Release counterpart of `controllerReady` (disconnect, or a scope switch
     * that drops the controller ahead of a re-adopt). Deregisters this writer and
     * clears the custom-config bookkeeping (`_customConfigSubscriptions` +
     * `_customAttrKeyMapping`) so a subsequent `controllerReady` (re-adoption
     * onto a different ctx) starts subscribing / mapping fresh instead of
     * treating stale attr names as custom on a now-defunct controller. The
     * subscriptions themselves — including the schema-change listener opened by
     * `_setupSchemaSync` and the per-custom-key observers — are `addDisposer`-
     * registered and already torn down by `ChildBlock._releaseController` before
     * this hook runs. NB: `_localValues` is intentionally NOT cleared — the next
     * adoption re-seeds against it.
     */
    protected override controllerReleased(): void {
      this._writerConfig?.unregisterWriter(this);
      this._writerConfig = undefined;
      this._customConfigSubscriptions.clear();
      this._customAttrKeyMapping = {};
    }

    public override disconnectedCallback(): void {
      super.disconnectedCallback();

      // `super.disconnectedCallback()` (→ `ChildBlock._releaseController`) already
      // tore down every `addDisposer`'d subscription — the schema-change listener
      // AND the per-custom-key observers (each `addDisposer`'d in
      // `_syncCustomConfigs`) — and ran `controllerReleased`, which clears
      // `_customConfigSubscriptions` + `_customAttrKeyMapping`. Only the
      // MutationObserver needs manual cleanup: it observes this element's own node
      // (per-element lifetime, created once behind an idempotency guard), so it's
      // outside the adoption-scoped disposer engine.
      if (this._mutationObserver) {
        this._mutationObserver.disconnect();
        this._mutationObserver = undefined;
      }
    }
  }

  /**
   * Define empty DOM properties for all config keys on the mixin class prototype
   * to make them checkable using `key in element` syntax. This is required for
   * the frameworks' DOM property bindings to work.
   */
  for (const key of allConfigKeys) {
    (WithConfigClass.prototype as unknown as Record<string, unknown>)[key] = undefined;
  }

  return WithConfigClass as unknown as T & Constructor<ConfigHost>;
}
