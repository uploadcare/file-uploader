import { ContextConsumer } from '@lit/context';
import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
// Light-DOM rendering + `yield('slot', default)` API. Generic utility — no
// v1 state-system coupling. Will be ported into v2 in Phase K if/when v1
// source is removed.
import { LightDomMixin } from '../lit/LightDomMixin';
import { uploaderContext } from './context';
import type { UploaderController } from './controllers/UploaderController';
import { UploaderRegistry } from './UploaderRegistry';

/**
 * Base class for v2 child elements. Resolves the `UploaderController` via
 * either `@lit/context` (in-tree DOM ancestry) or the global registry
 * (cross-DOM via `ctx-name`). Subclasses MUST NOT touch `this.uploader`
 * during `connectedCallback` — only inside `controllerReady` or any later
 * callback. Use `this.uploaderOrNull` for guarded reads.
 */
export abstract class ChildBlock extends LightDomMixin(LitElement) {
  /**
   * v1-style "style attributes" applied to the host on connect — used
   * by `themes/uc-basic` CSS rules that key off attributes like
   * `[uc-modal]`, `[uc-drop-area]`, `[uc-dynamic-btn]`, etc. Subclasses
   * extend via:
   *
   *   static override styleAttrs = [...super.styleAttrs, 'uc-modal'];
   *
   * Cleaner than each subclass calling `this.setAttribute(..)` from
   * its own `connectedCallback` — also keeps the attribute list
   * statically inspectable.
   */
  public static styleAttrs: string[] = [];

  @property({ attribute: 'ctx-name' })
  public ctxName: string | undefined = undefined;

  private _controller: UploaderController | null = null;
  private _registryUnsub?: () => void;
  private _ctrlUnsubs: Array<() => void> = [];

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: `ContextConsumer` works by side-effect — constructing it subscribes the host to the upstream `<uc-uploader>` provider and fires the callback. The field reference keeps it alive for the host's lifetime.
  private _contextConsumer = new ContextConsumer(this, {
    context: uploaderContext,
    callback: (ctrl) => ctrl && this._adoptController(ctrl),
    subscribe: true,
  });

  protected get uploader(): UploaderController {
    if (!this._controller) {
      throw new Error(
        `${this.tagName.toLowerCase()}: UploaderController is not yet available. ` +
          'Either nest inside <uc-uploader> or set ctx-name to match an existing uploader.',
      );
    }
    return this._controller;
  }

  protected get uploaderOrNull(): UploaderController | null {
    return this._controller;
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    // Walk the prototype chain reading each class's `styleAttrs` —
    // matches v1's pattern of `[...super.styleAttrs, 'foo']` per
    // subclass. Reading off `this.constructor` directly works because
    // `static override` on each subclass shadows the base.
    const ctor = this.constructor as typeof ChildBlock;
    for (const attr of ctor.styleAttrs) {
      if (!this.hasAttribute(attr)) this.setAttribute(attr, '');
    }
    if (this.ctxName && !this._controller) {
      this._registryUnsub = UploaderRegistry.whenAvailable(this.ctxName, (ctrl) => this._adoptController(ctrl));
    }
  }

  public override disconnectedCallback(): void {
    this._registryUnsub?.();
    this._registryUnsub = undefined;
    this._releaseController();
    super.disconnectedCallback();
  }

  private _adoptController(ctrl: UploaderController): void {
    if (this._controller === ctrl) return;
    this._releaseController();
    this._controller = ctrl;
    const rerender = () => this.requestUpdate();
    for (const sub of this.subscriptionsFor(ctrl)) {
      this._ctrlUnsubs.push(sub(rerender));
    }
    // v1-compat: when `config.testMode` is on, reflect the tag name as a
    // `data-testid` attribute on the host so e2e tests can locate the
    // element via `page.getByTestId(tagName)`.
    this._ctrlUnsubs.push(ctrl.config.subscribe(() => this._syncTestId()));
    this._syncTestId();
    this.controllerReady(ctrl);
    this.requestUpdate();
  }

  private _syncTestId(): void {
    const ctrl = this._controller;
    if (!ctrl) return;
    const cfg = ctrl.config.values as { testMode?: boolean };
    if (cfg.testMode) {
      this.setAttribute('data-testid', this.tagName.toLowerCase());
    } else {
      this.removeAttribute('data-testid');
    }
  }

  private _releaseController(): void {
    for (const u of this._ctrlUnsubs) u();
    this._ctrlUnsubs = [];
    if (this._controller) {
      this.controllerReleased(this._controller);
      this._controller = null;
    }
  }

  /**
   * Subscribe-fn factories per sub-controller this element depends on. The
   * default subscribes to config + locale + plugins; override to add or
   * remove (e.g. add `ctrl.router.subscribe.bind(ctrl.router)` for
   * activity-aware elements).
   */
  protected subscriptionsFor(ctrl: UploaderController): Array<(listener: () => void) => () => void> {
    return [
      ctrl.config.subscribe.bind(ctrl.config),
      ctrl.locale.subscribe.bind(ctrl.locale),
      ctrl.plugins.subscribe.bind(ctrl.plugins),
    ];
  }

  protected controllerReady(_ctrl: UploaderController): void {}
  protected controllerReleased(_ctrl: UploaderController): void {}
}
