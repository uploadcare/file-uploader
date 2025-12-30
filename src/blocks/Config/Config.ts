// @ts-check
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
const attrKeyMapping: Record<string, keyof ConfigPlainType> = {
  ...Object.fromEntries(plainConfigKeys.map((key) => [toKebabCase(key), key])),
  ...Object.fromEntries(plainConfigKeys.map((key) => [key.toLowerCase(), key])),
};

/** Mapping of attribute names to state */
const attrStateMapping: Record<string, string> = {
  ...Object.fromEntries(plainConfigKeys.map((key) => [toKebabCase(key), sharedConfigKey(key)])),
  ...Object.fromEntries(plainConfigKeys.map((key) => [key.toLowerCase(), sharedConfigKey(key)])),
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

  private _flushValueToAttribute(key: keyof ConfigType, value: unknown) {
    if (!isComplexKey(key)) {
      // Flush the value to the DOM attributes
      const attrs = [...new Set([toKebabCase(key), key.toLowerCase()])];
      for (const attr of attrs) {
        if (typeof value === 'undefined' || value === null) {
          this.removeAttribute(attr);
        } else if (this.getAttribute(attr) !== value.toString()) {
          this.setAttribute(attr, value.toString());
        }
      }
    }
  }

  private _flushValueToState<TKey extends keyof ConfigType>(key: TKey, value: unknown) {
    if (this.$[sharedConfigKey(key)] !== value) {
      if (typeof value === 'undefined' || value === null) {
        // @ts-expect-error
        this.$[sharedConfigKey(key)] = initialConfig[key];
      } else {
        // @ts-expect-error
        this.$[sharedConfigKey(key)] = value;
      }
    }
  }

  private _setValue(key: keyof ConfigType, value: unknown) {
    const anyThis = this as any;

    const normalizedValue = normalizeConfigValue(key, value);

    const localPropName = getLocalPropName(key as string);
    if (anyThis[localPropName] === normalizedValue) return;

    this._assertSameValueDifferentReference(key, anyThis[localPropName], normalizedValue);

    anyThis[localPropName] = normalizedValue;

    // Flush the value to the state
    this._flushValueToAttribute(key, normalizedValue);
    this._flushValueToState(key, normalizedValue);

    this.debugPrint(`"${key}"`, normalizedValue);

    runAssertions(this.cfg);
  }

  private _getValue(key: keyof ConfigType) {
    const anyThis = this as any;
    const localPropName = getLocalPropName(key as string);
    return anyThis[localPropName] ?? this.$[sharedConfigKey(key)];
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

  public override initCallback(): void {
    super.initCallback();
    const anyThis = this as any;

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
      Object.defineProperty(this, key, {
        set: (value: unknown) => {
          this._setValue(key, value);
        },
        get: () => {
          return this._getValue(key);
        },
      });
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

  public override attributeChangedCallback(name: keyof typeof attrStateMapping, oldVal: string, newVal: string) {
    super.attributeChangedCallback(name, oldVal, newVal);

    if (oldVal === newVal) return;

    const anyThis = this as any;
    const key = attrKeyMapping[name];
    // attributeChangedCallback could be called before the initCallback
    // so we set the DOM property instead of calling this._setValue.
    // If the block was initialized, the value will be handled by the setter.
    // If the block was not initialized, the value will be set to the DOM property
    // and handled on initialization.
    if (key) {
      anyThis[key] = newVal;
    }

    if (attrStateMapping[name]) {
      (this as any)[name] = newVal;
    }
  }

  public static override get observedAttributes(): string[] {
    const superObserved = super.observedAttributes;
    return [...superObserved, ...Object.keys(attrKeyMapping)];
  }
}

/**
 * Define empty DOM properties for all config keys on the Custom Element class prototype to make them checkable using
 * `key in element` syntax. This is required for the frameworks DOM property bindings to work.
 */
for (const key of allConfigKeys) {
  (Config.prototype as any)[key] = undefined;
}

export interface Config extends ConfigType {}

declare global {
  interface HTMLElementTagNameMap {
    'uc-config': Config;
  }
}
