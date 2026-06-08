import { ChildBlock } from '../../abstract/ChildBlock';
import { CONFIG_ATTR_MAP } from '../../abstract/controllers/ConfigController';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { bindConfigToElement } from '../../abstract/ui-adapters';
import type { ConfigType } from '../../types/exported';
import { toKebabCase } from '../../utils/toKebabCase';

const kebabCase = toKebabCase;

/**
 * Config keys that can only be set as JS properties (functions / objects /
 * arrays). The attribute observer in `bindConfigToElement` skips them; we
 * install explicit accessors on the host that forward into the
 * `ConfigController`.
 */
/**
 * Config keys that can only be set as JS properties (functions / objects /
 * arrays). Used by `src/types/exported.ts` to derive `ConfigComplexType`.
 * Kept as an exported `const` for type-only consumers.
 */
export const complexConfigKeys = [
  'metadata',
  'plugins',
  'localeDefinitionOverride',
  'secureUploadsSignatureResolver',
  'secureDeliveryProxyUrlResolver',
  'iconHrefResolver',
  'fileValidators',
  'collectionValidators',
  'mediaRecorderOptions',
] as const satisfies ReadonlyArray<keyof ConfigType>;

/**
 * v1-compat shim — `<uc-config>`.
 *
 * Originally a `LitBlock` that owned the shared config nanostore. In v2
 * config lives on the `UploaderController` (resolved via `UploaderRegistry`
 * by `ctx-name`); this element forwards every attribute and JS-property
 * write into that controller.
 *
 * Plain config keys (`pubkey`, `multiple`, …) flow through
 * `bindConfigToElement` — both kebab-case AND lowercase attribute forms
 * supported (`pub-key` AND `pubkey`). Complex keys (`plugins`, `metadata`,
 * `fileValidators`, …) get explicit JS-property accessors installed below.
 *
 * **Required**: a sibling `<uc-uploader*>` element with the same
 * `ctx-name` attribute must exist somewhere in the document; without
 * one, the controller never resolves and config writes silently no-op
 * until it does (`UploaderRegistry.whenAvailable` queues the binding).
 *
 * @deprecated Set config attributes directly on `<uc-uploader-regular>`
 * (or any preset). The separate `<uc-config>` element will be removed in
 * the next major version.
 */
export class Config extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs];

  private _unbindConfig?: () => void;
  private _unbindCustomSync?: () => void;
  private _installedCustomKeys = new Set<string>();

  public override connectedCallback(): void {
    super.connectedCallback();
  }

  protected override controllerReady(ctrl: UploaderController): void {
    this._unbindConfig?.();
    this._unbindConfig = bindConfigToElement(this, ctrl.config);
    this._installComplexAccessors(ctrl);
    this._syncCustomAccessors(ctrl);
    this._unbindCustomSync?.();
    this._unbindCustomSync = ctrl.config.subscribe(() => this._syncCustomAccessors(ctrl));
  }

  protected override controllerReleased(): void {
    this._unbindConfig?.();
    this._unbindConfig = undefined;
    this._unbindCustomSync?.();
    this._unbindCustomSync = undefined;
  }

  /**
   * Define JS-property accessors for the function/object/array config keys
   * that can't ride along on the attribute observer. Pre-existing values
   * (set before the element resolved a controller — e.g. framework prop
   * binding) are forwarded into the controller before the accessor takes
   * over.
   */
  private _installComplexAccessors(ctrl: UploaderController): void {
    for (const key of complexConfigKeys) {
      // If an accessor already exists (re-attach via remount), skip.
      const existing = Object.getOwnPropertyDescriptor(this, key);
      if (existing && (existing.get || existing.set)) continue;
      const preset = (this as unknown as Record<string, unknown>)[key];
      if (preset !== undefined) {
        delete (this as unknown as Record<string, unknown>)[key];
        ctrl.config.set(key, preset as never);
      }
      Object.defineProperty(this, key, {
        configurable: true,
        enumerable: true,
        get: () => ctrl.config.values[key],
        set: (value) => ctrl.config.set(key, value as never),
      });
    }
  }

  /**
   * Install JS-property accessors for plugin-registered custom config keys.
   * Fires on every config notify; idempotent — keys already wired are
   * skipped. Pre-existing JS-property values on the element are forwarded
   * into the controller and then deleted so the accessor takes over.
   */
  private _syncCustomAccessors(ctrl: UploaderController): void {
    for (const key of ctrl.config.customKeys) {
      if (this._installedCustomKeys.has(key)) continue;
      this._installedCustomKeys.add(key);
      const existing = Object.getOwnPropertyDescriptor(this, key);
      const def = ctrl.config.customDefinition(key);
      // Pre-existing HTML attribute (set before plugin registered) — pull
      // the value into the controller now so subscribers see it.
      if (!def || def.attribute !== false) {
        for (const attr of [key, key.toLowerCase(), kebabCase(key)]) {
          if (this.hasAttribute(attr)) {
            const raw = this.getAttribute(attr);
            const parsed = def?.fromAttribute && raw !== null ? def.fromAttribute(raw) : raw;
            ctrl.config.setCustom(key, parsed);
            break;
          }
        }
      }
      if (existing && (existing.get || existing.set)) continue;
      const preset = (this as unknown as Record<string, unknown>)[key];
      if (preset !== undefined) {
        delete (this as unknown as Record<string, unknown>)[key];
        ctrl.config.setCustom(key, preset);
      }
      Object.defineProperty(this, key, {
        configurable: true,
        enumerable: true,
        get: () => ctrl.config.getCustom(key),
        set: (value) => ctrl.config.setCustom(key, value),
      });
    }
  }

  public override render(): null {
    // `<uc-config>` is purely state-bearing; nothing to render. Returning
    // `null` opts out of Lit's render pipeline entirely (no microtask, no
    // re-renders).
    return null;
  }

  /**
   * Forwards attribute writes into the controller synchronously. v1
   * pattern is `el.setAttribute('source-list', 'x'); api.initFlow();` —
   * `bindConfigToElement`'s `MutationObserver` is async and would let
   * `initFlow` read stale config. The override mirrors the write into
   * `controller.config.set` before returning.
   */
  public override setAttribute(name: string, value: string): void {
    super.setAttribute(name, value);
    const ctrl = this.uploaderOrNull;
    const key = CONFIG_ATTR_MAP[name];
    if (key) {
      if (ctrl) ctrl.config.set(key, value);
      return;
    }
    if (!ctrl) return;
    const customKey = this._matchCustomKey(ctrl, name);
    if (!customKey) return;
    const def = ctrl.config.customDefinition(customKey);
    if (def && def.attribute === false) return;
    const parsed = def?.fromAttribute ? def.fromAttribute(value) : value;
    ctrl.config.setCustom(customKey, parsed);
  }

  public override removeAttribute(name: string): void {
    super.removeAttribute(name);
    const ctrl = this.uploaderOrNull;
    const key = CONFIG_ATTR_MAP[name];
    if (key) {
      if (ctrl) ctrl.config.set(key, null);
      return;
    }
    if (!ctrl) return;
    const customKey = this._matchCustomKey(ctrl, name);
    if (!customKey) return;
    const def = ctrl.config.customDefinition(customKey);
    if (def && def.attribute === false) return;
    ctrl.config.resetCustom(customKey);
  }

  private _matchCustomKey(ctrl: UploaderController, attrName: string): string | null {
    const lower = attrName.toLowerCase();
    for (const key of ctrl.config.customKeys) {
      if (key === attrName || key === lower || kebabCase(key) === lower) return key;
    }
    return null;
  }
}

if (!customElements.get('uc-config')) {
  customElements.define('uc-config', Config);
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-config': Config;
  }
}
