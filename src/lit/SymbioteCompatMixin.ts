import { ContextConsumer, ContextProvider, createContext } from '@lit/context';
import { PubSub } from '@symbiotejs/symbiote';
import type { LitElement, PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { debounce } from '../utils/debounce';
import type { Constructor } from './Constructor';

// biome-ignore lint/suspicious/noExplicitAny: Shared state bag mirrors Symbiote's dynamic shape and can contain arbitrary user values
type SymbioteStateBag = Record<string, any>;

// Context for providing ctxName across component tree
export const ctxNameContext = createContext<string>('ctx-name-context');

/**
 * Interface for components using SymbioteMixin
 */
declare class SymbioteComponent {
  $: SymbioteStateBag;
  sub<T = unknown>(key: string, callback: (value: T) => void, init?: boolean): () => void;
  pub(key: string, value: unknown): void;
  set$(obj: SymbioteStateBag): void;
  has(key: string): boolean;
  add(key: string, val: unknown, rewrite?: boolean): void;
  add$(obj: SymbioteStateBag, rewrite?: boolean): void;
  initCallback(): void;
  sharedCtx: PubSub<Record<string, unknown>>;
  ctxName: string;
}

/**
 * SymbioteMixin - Compatibility layer between SymbioteJS and Lit Element
 *
 * This decorator allows Lit elements to use Symbiote's reactive state management
 * and data binding features while maintaining Lit's rendering capabilities.
 *
 * Usage:
 * @SymbioteMixin
 * class MyComponent extends LitElement { ... }
 */
export function SymbioteMixin<T extends Constructor<LitElement>>(ctor: T): T & Constructor<SymbioteComponent> {
  class SymbioteMixinClass extends ctor {
    private _symbioteSharedPubSub: PubSub<Record<string, unknown>> | null = null;
    private _symbioteFirstUpdated = false;
    private _needsReconnectInit = false;
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: keep consumer reference to maintain subscription lifecycle
    private _ctxNameConsumer: ContextConsumer<{ __context__: string | undefined }, this>;
    private _ctxNameProvider:
      | ContextProvider<{
          __context__: string | undefined;
        }>
      | undefined = undefined;
    private _warnedAboutLocalState = false;
    private _pendingSharedAdds: Map<string, { value: unknown; rewrite: boolean }> = new Map();
    private _symbioteSubscriptions: Set<() => void> = new Set();

    // Symbiote-style initial values declaration
    protected init$: Record<string, unknown> = {};
    protected ctxOwner = false;

    private _ctxNameAttr: string | undefined = undefined;

    private _pendingCtxInitOnConnect = false;

    @property({ type: String, attribute: 'ctx-name', noAccessor: true })
    get ctxNameAttr(): string | undefined {
      return this._ctxNameAttr;
    }

    set ctxNameAttr(value: string | undefined) {
      const normalizedValue = value ?? undefined;
      const oldValue = this._ctxNameAttr;
      if (oldValue === normalizedValue) {
        return;
      }
      this._ctxNameAttr = normalizedValue;
      this._handleCtxNameSourceChange();
    }

    @state()
    _ctxNameFromContext: string | undefined;

    @state()
    ctxName: string | undefined = this.effectiveCtxName;

    @state()
    private isInitialized = false;

    protected override shouldUpdate(_changedProperties: PropertyValues): boolean {
      if (!this.isInitialized) {
        return false;
      }
      return super.shouldUpdate(_changedProperties);
    }

    // biome-ignore lint/suspicious/noExplicitAny: mixin constructors must accept arbitrary arguments to satisfy Lit types
    constructor(...args: any[]) {
      super(...args);

      // Consume ctxName from parent context
      this._ctxNameAttr = this.getAttribute('ctx-name') || undefined;
      this.ctxName = this.effectiveCtxName;

      this._ctxNameConsumer = new ContextConsumer(this, {
        context: ctxNameContext,
        callback: (value) => {
          if (!value) {
            console.error('SymbioteMixin: Received invalid ctx-name from context');
            return;
          }
          this._ctxNameFromContext = value;
          this._handleCtxNameSourceChange();
        },
        subscribe: true,
      });
    }

    private get effectiveCtxName(): string | undefined {
      return this.ctxNameAttr || this._ctxNameFromContext || undefined;
    }

    private _handleCtxNameSourceChange(): void {
      this.ctxName = this.effectiveCtxName;

      if (!this.ctxName || this._symbioteFirstUpdated) {
        return;
      }

      if (this.isConnected) {
        this._performInitialization();
        return;
      }

      this._pendingCtxInitOnConnect = true;
    }

    protected override willUpdate(_changedProperties: PropertyValues): void {
      super.willUpdate(_changedProperties);

      // Update effective ctxName before updates
      this.ctxName = this.effectiveCtxName;

      if (this.ctxName) {
        if (!this._ctxNameProvider) {
          // Provide ctxName to children
          this._ctxNameProvider = new ContextProvider(this, {
            context: ctxNameContext,
            initialValue: this.ctxName,
          });
        } else {
          this._ctxNameProvider.setValue(this.ctxName);
        }
      }
    }

    private _getSharedInitEntries(): Array<[string, unknown]> {
      const entries = Object.entries(this.init$ || {});
      const sharedEntries: Array<[string, unknown]> = [];
      const localKeys: string[] = [];

      for (const [key, value] of entries) {
        if (key.startsWith('*')) {
          sharedEntries.push([key, value]);
        } else {
          localKeys.push(key);
        }
      }

      if (localKeys.length > 0 && !this._warnedAboutLocalState) {
        console.warn('SymbioteMixin: Local state entries are no longer supported and will be ignored:', localKeys);
        this._warnedAboutLocalState = true;
      }

      return sharedEntries;
    }

    private _getSharedInitSchema(): Record<string, unknown> {
      return Object.fromEntries(this._getSharedInitEntries());
    }

    private _ensureSharedSchema(): void {
      if (!Object.hasOwn(this, '_sharedSchema')) {
        const sharedSchema = Object.fromEntries(
          this._getSharedInitEntries().map(([key, value]) => [key.slice(1), value]),
        );
        Object.defineProperty(this, '_sharedSchema', {
          value: sharedSchema,
          writable: true,
          configurable: true,
        });
      }
    }

    private _getSharedSchemaRecord(): Record<string, unknown> {
      this._ensureSharedSchema();
      const sharedSchema = (this as { _sharedSchema?: Record<string, unknown> })._sharedSchema;
      return sharedSchema ?? {};
    }

    private _requireSharedKey(key: string): string {
      if (!key.startsWith('*')) {
        throw new Error(
          `SymbioteMixin: Local state key "${key}" is no longer supported. Use shared keys prefixed with "*".`,
        );
      }
      return key.slice(1);
    }

    private _applyPendingSharedAdds(): void {
      if (!this._symbioteSharedPubSub || this._pendingSharedAdds.size === 0) {
        return;
      }

      for (const [key, { value, rewrite }] of this._pendingSharedAdds) {
        this._symbioteSharedPubSub.add(key, value, rewrite);
      }
      this._pendingSharedAdds.clear();
    }

    private _getSharedPubSub(): PubSub<Record<string, unknown>> | null {
      if (!this._symbioteSharedPubSub && this.effectiveCtxName) {
        this._initSharedContext();
      }
      if (this._symbioteSharedPubSub) {
        this._applyPendingSharedAdds();
      }
      return this._symbioteSharedPubSub;
    }

    private _requireSharedPubSub(): PubSub<Record<string, unknown>> {
      const pubsub = this._getSharedPubSub();
      if (!pubsub) {
        throw new Error('SymbioteMixin: Shared context is not initialized.');
      }
      return pubsub;
    }

    /**
     * Initialize shared context after ctxName is available
     */
    private _initSharedContext() {
      const sharedSchema = this._getSharedSchemaRecord();
      const ctxName = this.effectiveCtxName;

      if (!ctxName) {
        console.error('SymbioteMixin: ctx-name is required for components with shared properties (*)');
        return;
      }

      if (!this._symbioteSharedPubSub) {
        // Try to get existing context
        this._symbioteSharedPubSub = PubSub.getCtx(ctxName, false);

        // If context doesn't exist, create it
        if (!this._symbioteSharedPubSub) {
          this._symbioteSharedPubSub = PubSub.registerCtx(sharedSchema, ctxName);
        }

        for (const [key, defaultValue] of Object.entries(sharedSchema)) {
          this._symbioteSharedPubSub.add(key, defaultValue, this.ctxOwner);
        }

        this._applyPendingSharedAdds();
      }
    }

    get sharedCtx(): PubSub<Record<string, unknown>> {
      return this._requireSharedPubSub();
    }

    /**
     * Proxy for getting/setting values in the shared Symbiote data store.
     * Keys must start with '*' as local state support has been removed.
     */
    get $(): SymbioteStateBag {
      if (this.effectiveCtxName) {
        this._initSharedContext();
      }
      return new Proxy(
        {},
        {
          get: (_target, key: string | symbol) => {
            if (typeof key !== 'string') {
              return undefined;
            }
            const sharedKey = this._requireSharedKey(key);
            return this._symbioteSharedPubSub?.read(sharedKey);
          },
          set: (_target, key: string | symbol, value: unknown) => {
            if (typeof key !== 'string') {
              return true;
            }
            const sharedKey = this._requireSharedKey(key);
            this._symbioteSharedPubSub?.pub(sharedKey, value);
            return true;
          },
        },
      );
    }

    sub<T = unknown>(key: string, callback: (value: T) => void, init = true): () => void {
      const sharedKey = this._requireSharedKey(key);
      const subscription = this._requireSharedPubSub().sub(sharedKey, callback as (value: unknown) => void, init);
      if (!subscription || typeof subscription.remove !== 'function') {
        return () => {};
      }

      const removeFn = subscription.remove.bind(subscription);
      let removed = false;
      const trackedRemove = () => {
        if (removed) {
          return;
        }
        removed = true;
        removeFn();
        this._symbioteSubscriptions.delete(trackedRemove);
      };
      this._symbioteSubscriptions.add(trackedRemove);
      return trackedRemove;
    }

    pub(key: string, value: unknown): void {
      const sharedKey = this._requireSharedKey(key);
      this._requireSharedPubSub().pub(sharedKey, value);
    }

    set$(obj: SymbioteStateBag): void {
      for (const [prop, value] of Object.entries(obj)) {
        this.pub(prop, value);
      }
    }

    has(key: string): boolean {
      const sharedKey = this._requireSharedKey(key);
      return this._symbioteSharedPubSub?.has(sharedKey) ?? false;
    }

    add(key: string, val: unknown, rewrite = false) {
      const sharedKey = this._requireSharedKey(key);
      const pubsub = this._getSharedPubSub();
      if (!pubsub) {
        if (!rewrite && this._pendingSharedAdds.has(sharedKey)) {
          return;
        }
        this._pendingSharedAdds.set(sharedKey, { value: val, rewrite });
        return;
      }
      this._pendingSharedAdds.delete(sharedKey);
      pubsub.add(sharedKey, val, rewrite);
    }

    add$(obj: SymbioteStateBag, rewrite = false) {
      for (const [prop, value] of Object.entries(obj)) {
        this.add(prop, value, rewrite);
      }
    }

    override connectedCallback() {
      super.connectedCallback();

      if (!this._symbioteFirstUpdated) {
        if (this.ctxName) {
          this._pendingCtxInitOnConnect = false;
          this._performInitialization();
        } else if (this._pendingCtxInitOnConnect && this.effectiveCtxName) {
          this._pendingCtxInitOnConnect = false;
          this._performInitialization();
        }
      } else if (this.isInitialized && this._needsReconnectInit) {
        this._needsReconnectInit = false;
        this.initCallback();
      }
    }

    /**
     * Perform component initialization
     */
    private _performInitialization() {
      if (this._symbioteFirstUpdated) return;
      this._symbioteFirstUpdated = true;

      // Initialize shared context
      this._initSharedContext();

      // Initialize properties from init$
      const sharedSchema = this._getSharedInitSchema();

      if (Object.keys(sharedSchema).length > 0) {
        const pubsub = this._requireSharedPubSub();
        for (const [key, defaultValue] of Object.entries(sharedSchema)) {
          const propKey = this._requireSharedKey(key);

          // For shared properties, check if value already exists in shared context
          const existingValue = pubsub.read(propKey);
          if (existingValue === undefined) {
            pubsub.pub(propKey, defaultValue);
          }

          // Set up two-way binding between Lit property and Symbiote data
          this.sub(
            key,
            debounce(async () => {
              await this.updateComplete;
              this.requestUpdate();
            }, 0),
            false,
          );
        }
      }

      // Call the user-defined init callback after everything is set up
      this.initCallback();

      this.isInitialized = true;

      // Request update to render with initialized state
      this.requestUpdate();
    }

    override firstUpdated(changedProperties: Map<PropertyKey, unknown>) {
      super.firstUpdated(changedProperties);
      // Post-render tasks can go here if needed
    }

    override updated(changedProperties: Map<PropertyKey, unknown>) {
      super.updated(changedProperties);

      // Sync changed properties to Symbiote data store
      const sharedSchema = this._getSharedInitSchema();

      if (Object.keys(sharedSchema).length > 0) {
        changedProperties.forEach((_oldValue, propName) => {
          if (typeof propName !== 'string') {
            return;
          }
          if (Object.hasOwn(sharedSchema, propName)) {
            const sharedKey = this._requireSharedKey(propName);
            const newValue = (this as Record<string, unknown>)[propName];
            const pubsub = this._symbioteSharedPubSub;
            if (pubsub && pubsub.read(sharedKey) !== newValue) {
              pubsub.pub(sharedKey, newValue);
            }
          }
        });
      }
    }

    override disconnectedCallback() {
      this._cleanupSymbioteSubscriptions();
      super.disconnectedCallback();
      if (this._symbioteFirstUpdated) {
        this._needsReconnectInit = true;
      }
    }

    private _cleanupSymbioteSubscriptions(): void {
      if (this._symbioteSubscriptions.size === 0) {
        return;
      }
      for (const unsubscribe of [...this._symbioteSubscriptions]) {
        unsubscribe();
      }
      this._symbioteSubscriptions.clear();
    }

    initCallback() {}
  }

  return SymbioteMixinClass as T & Constructor<SymbioteComponent>;
}
