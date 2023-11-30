/**
 * @template T
 * @typedef {new (...args: any[]) => T} GConstructor
 */

/**
 * This is a helper to create a class type extended with the provided set of instance properties. It's useful when there
 * are some dynamic generated properties or native overrides in the class. We're use it to define dynamic access
 * properties and events to subscribe to.
 *
 * @template {GConstructor<HTMLElement>} Base
 * @template {Record<string, any>} [InstanceProperties={}] Default is `{}`
 * @typedef {{
 *   new (...args: ConstructorParameters<Base>): InstanceProperties & InstanceType<Base>;
 * } & Omit<Base, 'new'>} MixinClass
 */

export {};
