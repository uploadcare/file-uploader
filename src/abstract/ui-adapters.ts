/**
 * UI adapters. These wire the pure-logic controllers up to DOM concerns —
 * HTML attributes, JS properties on elements, CustomEvent dispatch. The
 * controllers themselves remain DOM-free; everything DOM-touching lives here.
 */

import { CONFIG_ATTR_MAP, type ConfigController, PLAIN_CONFIG_KEYS } from '../abstract/controllers/ConfigController';
import type { ConfigType } from '../types/exported';
import { defaultConfig } from './config-defaults';
import type { EventBus, UploaderEventKey } from './EventBus';
import { UploaderEventType } from './EventBus';

/**
 * Bridge `<uc-uploader>` (or any element) attributes + JS properties to a
 * `ConfigController`. Returns a teardown function.
 */
export function bindConfigToElement(element: HTMLElement, config: ConfigController): () => void {
  // JS property accessors — typed get/set per config key.
  for (const key of PLAIN_CONFIG_KEYS) {
    if (Object.getOwnPropertyDescriptor(element, key)) continue;
    Object.defineProperty(element, key, {
      configurable: true,
      enumerable: true,
      get: () => config.get(key as keyof ConfigType),
      set: (v) => config.set(key as keyof ConfigType, v),
    });
  }

  // Bootstrap from existing attributes.
  for (const [attr, key] of Object.entries(CONFIG_ATTR_MAP)) {
    const val = element.getAttribute(attr);
    if (val !== null) config.set(key, val);
  }

  // Bootstrap from any JS properties set before the element upgraded.
  for (const key of PLAIN_CONFIG_KEYS) {
    const preExisting = (element as unknown as Record<string, unknown>)[key];
    if (preExisting !== undefined && preExisting !== defaultConfig[key]) {
      config.set(key, preExisting);
    }
  }

  // Observe future attribute changes.
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type !== 'attributes' || !m.attributeName) continue;
      const key = CONFIG_ATTR_MAP[m.attributeName];
      if (!key) continue;
      const raw = element.getAttribute(m.attributeName);
      config.set(key, raw);
    }
  });
  observer.observe(element, { attributes: true });

  return () => observer.disconnect();
}

/**
 * Bridge an `EventBus` to DOM `CustomEvent` dispatch on a target element.
 * Returns a teardown function.
 */
export function bindEventBusToElement(target: EventTarget, events: EventBus): () => void {
  return events.onAny((type, payload) => {
    target.dispatchEvent(new CustomEvent(type, { detail: payload }));
  });
}

export type { UploaderEventKey };
export { UploaderEventType };
