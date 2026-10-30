import type { LitElement } from 'lit';
import { logger } from '../abstract/logger';
import type { Constructor } from './Constructor';

const log = logger.scope('registerable-element');

type RegisterableElementMixinClassInterface = Constructor<LitElement> & {
  reg(tagName: string): void;
};

export function RegisterableElementMixin<T extends Constructor<LitElement>>(
  ctor: T,
): T & RegisterableElementMixinClassInterface {
  abstract class RegisterableElementMixinClass extends ctor {
    public static reg(tagName: string) {
      const currentCtor = this as unknown as CustomElementConstructor;
      const registeredClass = window.customElements.get(tagName);
      if (registeredClass) {
        if (registeredClass !== currentCtor) {
          log.warn(
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
      window.customElements.define(tagName, currentCtor);
    }
  }
  return RegisterableElementMixinClass as unknown as T & RegisterableElementMixinClassInterface;
}
