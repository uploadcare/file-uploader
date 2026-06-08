import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, type Ref, ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import '../../blocks/PluginActivityRenderer/uc-plugin-activity-host.css';
import '../Modal/Modal';
import { ChildBlock } from '../../abstract/ChildBlock';
import type {
  ActivityRegistration,
  PluginRegistryController,
} from '../../abstract/controllers/PluginRegistryController';
import type { UploaderController } from '../../abstract/controllers/UploaderController';

/**
 * v2 `<uc-plugin-activity-host>`. Mounts a plugin-registered activity
 * into a local container when it becomes the router's current activity
 * and tears it down when navigation moves away. Owns the `render() /
 * dispose()` lifecycle that plugins expose.
 */
export class PluginActivityHost extends ChildBlock {
  @property({ attribute: false })
  public registration?: ActivityRegistration;

  private _container: Ref<HTMLDivElement> = createRef();
  private _dispose: (() => void) | undefined = undefined;
  private _isMounted = false;

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [ctrl.router.subscribe.bind(ctrl.router), ctrl.plugins.subscribe.bind(ctrl.plugins)];
  }

  public override updated(): void {
    const ctrl = this.uploaderOrNull;
    const reg = this.registration;
    if (!ctrl || !reg) return;
    // v1's per-activity CSS rules (e.g. `[uc-modal] > dialog:has(
    // [activity="camera"][active])`) key off these two attributes,
    // applied to whatever activity element is inside the modal.
    // setAttribute / toggleAttribute don't trigger requestUpdate
    // unless the attribute is reflected to a property, so it's safe to
    // do here.
    this.setAttribute('activity', reg.id);
    // Same rule as ActivityBlock — modal-wrapped hosts track the
    // foreground slot; inline ones (the renderer in `mode="inline"`)
    // track the background.
    const isInModal = this.closest('uc-modal') !== null;
    const slot = isInModal ? ctrl.router.modal : ctrl.router.activity;
    const isActive = slot === reg.id;
    this.toggleAttribute('active', isActive);
    if (isActive && !this._isMounted) this._mount(ctrl);
    else if (!isActive && this._isMounted) this._unmount();
  }

  private _mount(ctrl: UploaderController): void {
    const container = this._container.value;
    if (!container || !this.registration) return;
    try {
      this._dispose = this.registration.render(container, ctrl.router.params as Record<string, unknown>) ?? undefined;
      this._isMounted = true;
    } catch (err) {
      console.error(`[v2] activity "${this.registration.id}" render threw`, err);
    }
  }

  private _unmount(): void {
    try {
      this._dispose?.();
    } catch (err) {
      console.error(`[v2] activity "${this.registration?.id}" dispose threw`, err);
    }
    this._dispose = undefined;
    this._container.value?.replaceChildren();
    this._isMounted = false;
  }

  public override disconnectedCallback(): void {
    this._unmount();
    super.disconnectedCallback();
  }

  public override render() {
    return html`<div style="display: contents;" ${ref(this._container)}></div>`;
  }
}

if (!customElements.get('uc-plugin-activity-host'))
  customElements.define('uc-plugin-activity-host', PluginActivityHost);

/**
 * v2 `<uc-plugin-activity-renderer>`. Reads the v2 plugin registry and
 * renders one `<uc-modal>` per activity registration. Each modal hosts
 * a `<uc-plugin-activity-host>` that mounts the plugin's content when
 * the router lands on its activity id.
 */
export class PluginActivityRenderer extends ChildBlock {
  @property({ type: String })
  public mode: 'modal' | 'inline' = 'modal';

  @state()
  private _activities: ActivityRegistration[] = [];

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [ctrl.plugins.subscribe.bind(ctrl.plugins)];
  }

  protected override controllerReady(ctrl: UploaderController): void {
    this._syncActivities(ctrl.plugins);
  }

  // Pull the latest list in `willUpdate` so writes to `_activities`
  // land inside the current cycle. Doing it in `updated()` triggers
  // Lit's "change-in-update" dev warning.
  public override willUpdate(): void {
    const ctrl = this.uploaderOrNull;
    if (ctrl) this._syncActivities(ctrl.plugins);
  }

  private _syncActivities(registry: PluginRegistryController): void {
    const next = registry.activities;
    if (next.length === this._activities.length && next.every((a, i) => a.id === this._activities[i]?.id)) return;
    this._activities = next;
  }

  public override render() {
    if (this.mode === 'inline') {
      return html`${repeat(
        this._activities,
        (a) => a.id,
        (a) => html`<uc-plugin-activity-host .registration=${a}></uc-plugin-activity-host>`,
      )}`;
    }
    return html`${repeat(
      this._activities,
      (a) => a.id,
      (a) => html`
        <uc-modal id=${a.id} strokes block-body-scrolling>
          <uc-plugin-activity-host .registration=${a}></uc-plugin-activity-host>
        </uc-modal>
      `,
    )}`;
  }
}

if (!customElements.get('uc-plugin-activity-renderer'))
  customElements.define('uc-plugin-activity-renderer', PluginActivityRenderer);
