import { ContextConsumer, ContextProvider, createContext } from '@lit/context';
import { PubSub } from '@symbiotejs/symbiote';
import type { LitElement, PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { LitCtor } from './LitCtor';
import { parseCssPropertyValue } from './parseCssPropertyValue';

// Context for providing ctxName across component tree
export const ctxNameContext = createContext<string>('ctx-name-context');

/**
 * Interface for components using SymbioteMixin
 */
export interface SymbioteComponent {
  $: Record<string, any>;
  sub(key: string, callback: (value: any) => void, init?: boolean): () => void;
  pub(key: string, value: any, silent?: boolean): void;
  addComputed(key: string, callback: () => any, dependencies: string[]): void;
  initCallback?(): void;
}

/**
 * Constructor type for SymbioteMixin
 */
export interface SymbioteConstructor {
  bindAttributes(attributes: Record<string, any>): any;
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
export function SymbioteMixin<T extends LitCtor<LitElement>>(
  ctor: T,
): T & LitCtor<SymbioteComponent> & SymbioteConstructor {
  abstract class SymbioteMixinClass extends ctor {
    private _symbiotePubSub: PubSub<any> | null = null;
    private _symbioteSharedPubSub: PubSub<any> | null = null;
    private _symbioteInitialized = false;
    private _symbioteFirstUpdated = false;
    private _initializationTimeout: number | null = null;
    private _ctxNameConsumer: ContextConsumer<{ __context__: string | undefined }, this>;
    private _ctxNameProvider: ContextProvider<{
      __context__: string | undefined;
    }>;

    // Symbiote-style initial values declaration
    protected init$: any = {};

    static properties = {
      // @ts-expect-error
      ...super.properties,
      ctxNameAttr: {
        type: String,
        attribute: 'ctx-name',
        reflect: false,
        noAccessor: true,
      },
    };
    declare ctxNameAttr: string;

    @state()
    _ctxNameFromContext: string | undefined;

    @state()
    ctxName: string | undefined = this._effectiveCtxName;

    constructor(...args: any[]) {
      super(...args);

      // Consume ctxName from parent context
      this._ctxNameConsumer = new ContextConsumer(this, {
        context: ctxNameContext,
        callback: (value) => {
          this._ctxNameFromContext = value;
          this.requestUpdate();
        },
        subscribe: true,
      });

      // Provide ctxName to children
      this._ctxNameProvider = new ContextProvider(this, {
        context: ctxNameContext,
      });
    }

    private get _effectiveCtxName(): string | undefined {
      return (
        this.ctxNameAttr ||
        this._ctxNameFromContext ||
        parseCssPropertyValue(window.getComputedStyle(this).getPropertyValue('--ctx').trim()) ||
        undefined
      );
    }

    protected override willUpdate(_changedProperties: PropertyValues): void {
      super.willUpdate(_changedProperties);

      // Update effective ctxName before updates
      this.ctxName = this._effectiveCtxName;
      if (this._effectiveCtxName) {
        this.style.setProperty('--ctx', this._effectiveCtxName);
      }
    }

    /**
     * Initialize Symbiote's PubSub for this component
     */
    private _initSymbiote() {
      if (!this._symbioteInitialized) {
        const ctor = this.constructor as any;
        const schema = ctor._symbioteAttributes || {};

        // Merge schema with instance init$ values
        const instanceInit = this.init$ || {};
        const mergedSchema = { ...schema, ...instanceInit };

        // Separate local and shared schemas
        const localSchema: Record<string, any> = {};
        const sharedSchema: Record<string, any> = {};

        for (const [key, value] of Object.entries(mergedSchema)) {
          if (key.startsWith('*')) {
            // Store without the * prefix in the schema
            sharedSchema[key.slice(1)] = value;
          } else {
            localSchema[key] = value;
          }
        }

        // Create local PubSub
        this._symbiotePubSub = new PubSub(localSchema);

        // Store shared schema for later initialization
        if (!this.hasOwnProperty('_sharedSchema')) {
          Object.defineProperty(this, '_sharedSchema', {
            value: sharedSchema,
            writable: true,
            configurable: true,
          });
        }
        (this as any)._sharedSchema = sharedSchema;

        this._symbioteInitialized = true;
      }
    }

    // override shouldUpdate() {
    //   return !!this._effectiveCtxName;
    // }

    /**
     * Initialize shared context after ctxName is available
     */
    private _initSharedContext() {
      const sharedSchema = (this as any)._sharedSchema || {};
      const ctxName = this._effectiveCtxName;

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
      }
    }

    /**
     * Get the Symbiote PubSub instance
     */
    protected get $data(): PubSub<any> {
      if (!this._symbiotePubSub) {
        this._initSymbiote();
      }
      return this._symbiotePubSub!;
    }

    /**
     * Proxy for getting/setting values in the Symbiote data store
     * Properties starting with '*' use shared context
     * Usage: this.$['key'] or this.$.key (for get) and this.$['key'] = value or this.$.key = value (for set)
     */
    get $(): Record<string, any> {
      return new Proxy(
        {},
        {
          get: (_target, key: string) => {
            if (key.startsWith('*')) {
              return this._symbioteSharedPubSub?.read(key.slice(1));
            }
            return this.$data.read(key);
          },
          set: (_target, key: string, value: any) => {
            if (key.startsWith('*')) {
              this._symbioteSharedPubSub?.pub(key.slice(1), value);
            } else {
              this.$data.pub(key, value);
            }
            return true;
          },
        },
      );
    }

    /**
     * Subscribe to changes on a specific property
     * Properties starting with '*' use shared context
     */
    sub(key: string, callback: (value: any) => void, init = false): () => void {
      if (key.startsWith('*') && this._symbioteSharedPubSub) {
        const subscription = this._symbioteSharedPubSub.sub(key.slice(1), callback, init);
        return subscription ? subscription.remove : () => {};
      }
      const subscription = this.$data.sub(key, callback, init);
      return subscription ? subscription.remove : () => {};
    }

    /**
     * Publish a value to a specific property
     */
    pub(key: string, value: any): void {
      if (key.startsWith('*')) {
        this._symbioteSharedPubSub?.pub(key.slice(1), value);
      } else {
        this.$data.pub(key, value);
      }
    }

    /**
     * Static method to bind attributes as reactive properties
     */
    static bindAttributes(attributes: Record<string, any>) {
      // Store the attributes definition for later use
      if (!this.hasOwnProperty('_symbioteAttributes')) {
        Object.defineProperty(this, '_symbioteAttributes', {
          value: {},
          writable: true,
          configurable: true,
        });
      }
      (this as any)._symbioteAttributes = {
        ...(this as any)._symbioteAttributes,
        ...attributes,
      };

      // Register Lit properties for each attribute
      const ctor = this as unknown as typeof LitElement;
      if (!ctor.hasOwnProperty('elementProperties')) {
        ctor.createProperty('_init', {});
      }

      for (const [key, defaultValue] of Object.entries(attributes)) {
        const type = typeof defaultValue === 'number' ? Number : typeof defaultValue === 'boolean' ? Boolean : String;
        ctor.createProperty(key, { type, reflect: true });
      }

      return this;
    }

    override connectedCallback() {
      super.connectedCallback();

      if (!this._symbioteFirstUpdated) {
        // Initialize local PubSub immediately
        this._initSymbiote();

        // Check if we have shared properties
        const ctor = this.constructor as any;
        const mergedSchema = {
          ...(ctor._symbioteAttributes || {}),
          ...(this.init$ || {}),
        };
        const hasSharedProps = Object.keys(mergedSchema).some((key) => key.startsWith('*'));

        if (hasSharedProps && !this.ctxName) {
          // Wait for ctx-name attribute to be set (with timeout)
          this._initializationTimeout = window.setTimeout(() => {
            this._performInitialization();
          }, 50); // 50ms timeout for async ctx-name setting
        } else {
          // Initialize immediately if ctx-name is already available or no shared props
          this._performInitialization();
        }
      }
    }

    /**
     * Perform component initialization
     */
    private _performInitialization() {
      if (this._symbioteFirstUpdated) return;
      this._symbioteFirstUpdated = true;

      // Clear timeout if exists
      if (this._initializationTimeout !== null) {
        clearTimeout(this._initializationTimeout);
        this._initializationTimeout = null;
      }

      // Initialize shared context
      this._initSharedContext();

      // Initialize bound attributes
      const ctor = this.constructor as any;
      const mergedSchema = {
        ...(ctor._symbioteAttributes || {}),
        ...(this.init$ || {}),
      };

      if (Object.keys(mergedSchema).length > 0) {
        for (const [key, defaultValue] of Object.entries(mergedSchema)) {
          const isShared = key.startsWith('*');
          const pubsub = isShared && this._symbioteSharedPubSub ? this._symbioteSharedPubSub : this.$data;
          const propKey = isShared ? key.slice(1) : key;

          // For shared properties, check if value already exists in shared context
          const existingValue = pubsub.read(propKey);
          if (existingValue === undefined) {
            if ((this as any)[key] === undefined) {
              (this as any)[key] = defaultValue;
            }
            pubsub.pub(propKey, (this as any)[key]);
          } else {
            // Use existing shared value
            (this as any)[key] = existingValue;
          }

          // Set up two-way binding between Lit property and Symbiote data
          this.sub(
            key,
            (value) => {
              if ((this as any)[key] !== value) {
                (this as any)[key] = value;
                this.requestUpdate();
              }
            },
            false,
          );
        }
      }

      // Call the user-defined init callback after everything is set up
      if (typeof (this as any).initCallback === 'function') {
        (this as any).initCallback();
      }

      // Request update to render with initialized state
      this.requestUpdate();
    }

    override firstUpdated(changedProperties: Map<PropertyKey, unknown>) {
      super.firstUpdated(changedProperties);
      // Post-render tasks can go here if needed
    }

    override updated(changedProperties: Map<PropertyKey, unknown>) {
      super.updated(changedProperties);

      // Update context provider when ctxName changes
      if (changedProperties.has('ctxName')) {
        this._ctxNameProvider.setValue(this.ctxNameAttr);
      }

      // Sync changed properties to Symbiote data store
      const ctor = this.constructor as any;
      const mergedSchema = {
        ...(ctor._symbioteAttributes || {}),
        ...(this.init$ || {}),
      };

      if (Object.keys(mergedSchema).length > 0) {
        changedProperties.forEach((_oldValue, propName) => {
          if (mergedSchema.hasOwnProperty(propName)) {
            const key = propName as string;
            const newValue = (this as any)[key];
            const isShared = key.startsWith('*');
            const pubsub = isShared && this._symbioteSharedPubSub ? this._symbioteSharedPubSub : this.$data;
            const propKey = isShared ? key.slice(1) : key;

            if (pubsub.read(propKey) !== newValue) {
              pubsub.pub(propKey, newValue);
            }
          }
        });
      }
    }

    override disconnectedCallback() {
      super.disconnectedCallback();
      // Clean up initialization timeout
      if (this._initializationTimeout !== null) {
        clearTimeout(this._initializationTimeout);
        this._initializationTimeout = null;
      }
      // Clean up is handled automatically by PubSub
    }

    static reg(tagName: string) {
      const registeredClass = window.customElements.get(tagName) as any;
      if (registeredClass) {
        if (registeredClass !== this) {
          console.warn(
            [
              `Element with tag name "${tagName}" already registered.`,
              `You're trying to override it with another class "${this.name}".`,
              `This is most likely a mistake.`,
              `New element will not be registered.`,
            ].join('\n'),
          );
        }
        return;
      }
      window.customElements.define(tagName, this as any);
    }
  }

  return SymbioteMixinClass as unknown as T & LitCtor<SymbioteComponent> & SymbioteConstructor;
}
