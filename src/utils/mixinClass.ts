export type GConstructor<T> = new (...args: unknown[]) => T;

/**
 * This is a helper to create a class type extended with the provided set of instance properties. It's useful when there
 * are some dynamic generated properties or native overrides in the class. We're use it to define dynamic access
 * properties and events to subscribe to.
 *
 */
export type MixinClass<
  Base extends GConstructor<HTMLElement>,
  InstanceProperties extends Record<string, unknown> = Record<string, never>,
> = (new (...args: ConstructorParameters<Base>) => InstanceType<Base> & InstanceProperties) & Base;
