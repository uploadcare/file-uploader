import { ContextConsumer, ContextProvider, createContext } from '@lit/context';
import type { LitElement, PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { debounce } from '../utils/debounce';
import type { Constructor } from './Constructor';
import { PubSub } from './PubSubCompat';

type SymbioteStateBag<T extends Record<string, unknown>> = T;

// Context for providing ctxName across component tree
export const ctxNameContext = createContext<string>('ctx-name-context');

/**
 * Interface for components using SymbioteMixin
 */
export declare class SymbioteComponent<TState extends Record<string, unknown> = Record<string, unknown>> {
  public $: SymbioteStateBag<TState>;
  public sub<TKey extends keyof TState>(key: TKey, callback: (value: TState[TKey]) => void, init?: boolean): () => void;
  public pub<TKey extends keyof TState>(key: TKey, value: TState[TKey]): void;
  public set$<T extends { [K in keyof T]: K extends keyof TState ? TState[K] : never }>(obj: T): void;
  public has<TKey extends keyof TState>(key: TKey): boolean;
  public add<TKey extends keyof TState>(key: TKey, val: TState[TKey], rewrite?: boolean): void;
  public add$<T extends { [K in keyof T]: K extends keyof TState ? TState[K] : never }>(
    obj: T,
    rewrite?: boolean,
  ): void;
  public initCallback(): void;
  public ctxName: string;
  public ctxOwner: boolean;
}

/**
 * SymbioteMixin - Compatibility layer between SymbioteJS and Lit Element
 *
 * This decorator allows Lit elements to use Symbiote's reactive state management
 * and data binding features while maintaining Lit's rendering capabilities.
 *
 * Usage:
 * class MyComponent extends SymbioteMixin<MyStateType>()(LitElement) { ... }
 * // or without state type:
 * class MyComponent extends SymbioteMixin()(LitElement) { ... }
 */
export function SymbioteMixin<TState extends Record<string, unknown> = Record<string, unknown>>() {
  return function <TCtor extends Constructor<LitElement>>(ctor: TCtor): TCtor & Constructor<SymbioteComponent<TState>> {
    class SymbioteMixinClass extends ctor {
      private _symbioteSharedPubSub: PubSub<TState> | null = null;
      private _symbioteFirstUpdated = false;
      private _needsReconnectInit = false;
      // biome-ignore lint/correctness/noUnusedPrivateClassMembers: keep consumer reference to maintain subscription lifecycle
      private _ctxNameConsumer: ContextConsumer<{ __context__: string | undefined }, this>;
      private _ctxNameProvider:
        | ContextProvider<{
            __context__: string | undefined;
          }>
        | undefined = undefined;
      private _pendingSharedAdds: Map<keyof TState, { value: TState[keyof TState]; rewrite: boolean }> = new Map();
      private _symbioteSubscriptions: Set<() => void> = new Set();

      // Symbiote-style initial values declaration
      protected init$: TState = {} as TState;
      public ctxOwner = false;

      private _ctxNameAttrValue: string | undefined = undefined;

      private _pendingCtxInitOnConnect = false;

      @property({ type: String, attribute: 'ctx-name', noAccessor: true })
      private get _ctxNameAttr(): string | undefined {
        return this._ctxNameAttrValue;
      }

      private set _ctxNameAttr(value: string | undefined) {
        const normalizedValue = value ?? undefined;
        const oldValue = this._ctxNameAttrValue;
        if (oldValue === normalizedValue) {
          return;
        }
        this._ctxNameAttrValue = normalizedValue;
        this._handleCtxNameSourceChange();
      }

      @state()
      private _ctxNameFromContext: string | undefined;

      @state()
      public ctxName: string | undefined = this._effectiveCtxName;

      @state()
      private _isInitialized = false;

      protected override shouldUpdate(changedProperties: PropertyValues<this>): boolean {
        if (!this._isInitialized) {
          return false;
        }
        return super.shouldUpdate(changedProperties);
      }

      public constructor(...args: any[]) {
        super(...args);

        // Consume ctxName from parent context
        this._ctxNameAttrValue = this.getAttribute('ctx-name') || undefined;
        this.ctxName = this._effectiveCtxName;

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

      private get _effectiveCtxName(): string | undefined {
        return this._ctxNameAttr || this._ctxNameFromContext || undefined;
      }

      private _handleCtxNameSourceChange(): void {
        this.ctxName = this._effectiveCtxName;

        if (!this.ctxName || this._symbioteFirstUpdated) {
          return;
        }

        if (this.isConnected) {
          this._performInitialization();
          return;
        }

        this._pendingCtxInitOnConnect = true;
      }

      protected override willUpdate(changedProperties: PropertyValues<this>): void {
        super.willUpdate(changedProperties);

        // Update effective ctxName before updates
        this.ctxName = this._effectiveCtxName;

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

      private _applyPendingSharedAdds(): void {
        if (!this._symbioteSharedPubSub || this._pendingSharedAdds.size === 0) {
          return;
        }

        for (const [key, { value, rewrite }] of this._pendingSharedAdds) {
          this._symbioteSharedPubSub.add(key, value, rewrite);
        }
        this._pendingSharedAdds.clear();
      }

      private _getSharedPubSub(): PubSub<TState> | null {
        if (!this._symbioteSharedPubSub && this._effectiveCtxName) {
          this._initSharedContext();
        }
        if (this._symbioteSharedPubSub) {
          this._applyPendingSharedAdds();
        }
        return this._symbioteSharedPubSub;
      }

      private _requireSharedPubSub(): PubSub<TState> {
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
        const initialValue = this.init$;
        const ctxName = this._effectiveCtxName;

        if (!ctxName) {
          console.error('SymbioteMixin: ctx-name is required for components with shared properties (*)');
          return;
        }

        if (!this._symbioteSharedPubSub) {
          this._symbioteSharedPubSub =
            PubSub.getCtx<TState>(ctxName) ?? PubSub.registerCtx<TState>(initialValue, ctxName);

          for (const [key, defaultValue] of Object.entries(this.init$) as [keyof TState, TState[keyof TState]][]) {
            this._symbioteSharedPubSub.add(key, defaultValue, this.ctxOwner);
          }

          this._applyPendingSharedAdds();
        }
      }

      /**
       * Proxy for getting/setting values in the shared Symbiote data store.
       * Keys must start with '*' as local state support has been removed.
       */
      public get $(): SymbioteStateBag<TState> {
        if (this._effectiveCtxName) {
          this._initSharedContext();
        }
        return new Proxy(
          {},
          {
            get: <TKey extends keyof TState>(_target: never, key: TKey | symbol) => {
              if (typeof key !== 'string') {
                return undefined;
              }
              return this._symbioteSharedPubSub?.read(key);
            },
            set: <TKey extends keyof TState>(_target: never, key: TKey | symbol, value: TState[TKey]) => {
              if (typeof key !== 'string') {
                return true;
              }
              this._symbioteSharedPubSub?.pub(key, value);
              return true;
            },
          },
        ) as SymbioteStateBag<TState>;
      }

      public sub<TKey extends keyof TState>(
        key: TKey,
        callback: (value: TState[TKey]) => void,
        init = true,
      ): () => void {
        const subscription = this._requireSharedPubSub().sub(key, callback as (value: unknown) => void, init);
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

      public pub<TKey extends keyof TState>(key: TKey, value: TState[TKey]): void {
        this._requireSharedPubSub().pub(key, value);
      }

      public set$<T extends { [K in keyof T]: K extends keyof TState ? TState[K] : never }>(obj: T): void {
        for (const [prop, value] of Object.entries(obj) as [keyof TState, TState[keyof TState]][]) {
          this.pub(prop, value);
        }
      }

      public has(key: keyof TState): boolean {
        return this._symbioteSharedPubSub?.has(key) ?? false;
      }

      public add<TKey extends keyof TState>(key: TKey, val: TState[TKey], rewrite = false) {
        const pubsub = this._getSharedPubSub();
        if (!pubsub) {
          if (!rewrite && this._pendingSharedAdds.has(key)) {
            return;
          }
          this._pendingSharedAdds.set(key, { value: val, rewrite });
          return;
        }
        this._pendingSharedAdds.delete(key);
        pubsub.add(key, val, rewrite);
      }

      public add$<T extends { [K in keyof T]: K extends keyof TState ? TState[K] : never }>(obj: T, rewrite = false) {
        for (const [prop, value] of Object.entries(obj) as [keyof TState, TState[keyof TState]][]) {
          this.add(prop, value, rewrite);
        }
      }

      public override connectedCallback() {
        super.connectedCallback();

        if (!this._symbioteFirstUpdated) {
          if (this.ctxName) {
            this._pendingCtxInitOnConnect = false;
            this._performInitialization();
          } else if (this._pendingCtxInitOnConnect && this._effectiveCtxName) {
            this._pendingCtxInitOnConnect = false;
            this._performInitialization();
          }
        } else if (this._isInitialized && this._needsReconnectInit) {
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
        const sharedSchema = this.init$;

        if (Object.keys(sharedSchema).length > 0) {
          const pubsub = this._requireSharedPubSub();
          for (const [key, defaultValue] of Object.entries(sharedSchema) as [keyof TState, TState[keyof TState]][]) {
            // For shared properties, check if value already exists in shared context
            const existingValue = pubsub.read(key);
            if (existingValue === undefined) {
              pubsub.pub(key, defaultValue);
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

        this._isInitialized = true;

        // Request update to render with initialized state
        this.requestUpdate();
      }

      public override firstUpdated(changedProperties: PropertyValues<this>) {
        super.firstUpdated(changedProperties);
        // Post-render tasks can go here if needed
      }

      public override disconnectedCallback() {
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

      public initCallback() {}
    }

    return SymbioteMixinClass as TCtor & Constructor<SymbioteComponent<TState>>;
  };
}
