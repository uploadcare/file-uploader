// @ts-check
import { Data, UID } from '@symbiotejs/symbiote';

const MSG_NAME = '[Typed State] Wrong property name: ';
const MSG_TYPE = '[Typed State] Wrong property type: ';

/** @typedef {Record<string, { type: unknown; value: unknown; nullable?: boolean }>} TypedSchema */

/**
 * @template {any} [T=any] Default is `any`
 * @typedef {new (...args: any[]) => T} Constructor
 */

/**
 * @template {unknown} T
 * @template {unknown} V
 * @typedef {T extends StringConstructor
 *   ? string
 *   : T extends BooleanConstructor
 *     ? boolean
 *     : T extends NumberConstructor
 *       ? number
 *       : T extends ArrayConstructor
 *         ? V
 *         : T extends Constructor
 *           ? InstanceType<T>
 *           : T} ExtractType
 */

/**
 * @template {TypedSchema} T
 * @typedef {{
 *   [K in keyof T]: ExtractType<T[K]['type'], T[K]['value']> | (T[K]['nullable'] extends true ? null : never);
 * }} ExtractDataFromSchema
 */

/**
 * @template {TypedSchema} T
 * @typedef {Extract<keyof T, string>} ExtractKeysFromSchema
 */

/** @template {TypedSchema} T */
export class TypedData {
  /**
   * @param {T} typedSchema
   * @param {String} [ctxName]
   */
  constructor(typedSchema, ctxName) {
    /**
     * @private
     * @type {T}
     */
    this.__typedSchema = typedSchema;

    /**
     * @private
     * @type {string}
     */
    this.__ctxId = ctxName || UID.generate();

    /**
     * @private
     * @type {ExtractDataFromSchema<T>}
     */
    this.__schema = Object.keys(typedSchema).reduce((acc, key) => {
      /** @type {any} */ (acc)[key] = typedSchema[key].value;
      return acc;
    }, /** @type {ExtractDataFromSchema<T>} */ ({}));
    /**
     * @private
     * @type {Data}
     */
    this.__data = Data.registerCtx(this.__schema, this.__ctxId);
  }

  /** @returns {string} */
  get uid() {
    return this.__ctxId;
  }

  /**
   * @param {ExtractKeysFromSchema<T>} prop
   * @param {ExtractDataFromSchema<T>[prop]} value
   */
  setValue(prop, value) {
    if (!this.__typedSchema.hasOwnProperty(prop)) {
      console.warn(MSG_NAME + prop);
      return;
    }
    let pDesc = this.__typedSchema[prop];

    let isMatchConstructorType = value?.constructor === pDesc.type;
    let isMatchInstanceType = /** @type {any} */ (value) instanceof /** @type {any} */ (pDesc['type']);
    let isMatchNullable = pDesc.nullable && value === null;

    if (isMatchConstructorType || isMatchInstanceType || isMatchNullable) {
      this.__data.pub(prop, value);
      return;
    }
    console.warn(MSG_TYPE + prop);
  }

  /** @param {Partial<ExtractDataFromSchema<T>>} updObj */
  setMultipleValues(updObj) {
    for (let [prop, value] of Object.entries(updObj)) {
      this.setValue(/** @type {ExtractKeysFromSchema<T>} */ (prop), value);
    }
  }

  /**
   * @template {ExtractKeysFromSchema<T>} K
   * @param {K} prop
   * @returns {ExtractDataFromSchema<T>[K]}
   */
  getValue(prop) {
    if (!this.__typedSchema.hasOwnProperty(prop)) {
      console.warn(MSG_NAME + prop);
    }
    return this.__data.read(prop);
  }

  /**
   * @template {ExtractKeysFromSchema<T>} K
   * @param {K} prop
   * @param {(newVal: ExtractDataFromSchema<T>[K]) => void} handler
   */
  subscribe(prop, handler) {
    return this.__data.sub(prop, handler);
  }

  remove() {
    Data.deleteCtx(this.__ctxId);
  }
}
