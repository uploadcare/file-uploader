import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import type { ActivityType } from '../../abstract/activity-constants';
import { RouterController } from '../../abstract/controllers/RouterController';
import { injectOrNull } from '../../abstract/di/inject';
import type {
  Owned,
  PluginActivityRegistration,
  PluginLabel,
  PluginRenderDispose,
} from '../../abstract/managers/plugin';
import { PluginController } from '../../abstract/managers/plugin';
import { ActivityChildBlock } from '../../lit/ActivityChildBlock';
import { ChildBlock } from '../../lit/ChildBlock';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import '../Modal/Modal';
import './uc-plugin-activity-host.css';

export class PluginActivityHost extends ActivityChildBlock {
  @property({ attribute: false })
  public registration!: Owned<PluginActivityRegistration>;

  private _dispose?: PluginRenderDispose;
  private _containerRef = createRef<HTMLDivElement>();
  private _isMounted = false;

  // Before `super`, which reports the type and sets the `activity` attribute when it changes.
  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('registration')) {
      this.activityType = (this.registration?.id as ActivityType) ?? null;
    }
    super.willUpdate(changed);
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed); // reflects [active] for the current slot

    // Own the plugin's render()/dispose() lifecycle: mount when this activity
    // becomes the current one, tear down when navigation moves away.
    const active = this.isActivityActive;
    if (active && !this._isMounted) {
      this._mount();
    } else if (!active && this._isMounted) {
      this._unmount();
    }
  }

  private _mount(): void {
    const container = this._containerRef.value;
    if (!container || !this.registration) {
      return;
    }
    try {
      this._dispose = this.registration.render(container, this._router.params) ?? undefined;
      this._isMounted = true;
    } catch (error) {
      this._log.error(`Plugin "${this.registration.pluginId}" Activity render() threw an error`, error);
    }
  }

  private _unmount(): void {
    try {
      this._dispose?.();
    } catch (error) {
      this._log.error(`Plugin "${this.registration?.pluginId}" Activity dispose threw an error`, error);
    }
    this._dispose = undefined;
    this._containerRef.value?.replaceChildren();
    this._isMounted = false;
  }

  public override disconnectedCallback(): void {
    this._unmount();
    super.disconnectedCallback();
  }

  public override render() {
    return html`<div style="display: contents;" ${ref(this._containerRef)}></div>`;
  }
}

export class PluginActivityRenderer extends ChildBlock {
  @property({ type: String })
  public mode: 'modal' | 'inline' = 'modal';

  @state()
  private _activities: Owned<PluginActivityRegistration>[] = [];

  // Transiently null until the container resolves the `PluginController`
  // (`whenController`) — render falls back to an empty activity list meanwhile
  // (Icon/FileItem precedent). M-god step 8c: `PluginController` is
  // container-owned (bound by `ensurePluginManager`), but its binding is
  // CONDITIONAL — it exists only once an uploader scope attaches
  // (`ensureUploaderScope`), which may be after this block's `controllerReady`
  // fires (or never, in a bare ctx — see the "renders an empty activity list"
  // spec). A synchronous `use(PluginController)` would throw on an unresolved
  // token; `whenController` fires now if resolved, else on first resolution,
  // yielding the SAME container instance — the now-or-when-available successor
  // to `bag.when('pluginManager')`.
  private _pluginManager: PluginController | null = null;

  @injectOrNull(RouterController) private readonly _router!: RouterController | null;

  /** @internal */
  @subscription()
  protected _wirePluginActivities(): Unsubscribe {
    return this.container.whenController(PluginController, (pluginManager) => {
      this._pluginManager = pluginManager;
      this._syncActivities();
      return pluginManager.onPluginsChange(() => this._syncActivities());
    });
  }

  protected override controllerReleased(): void {
    this._pluginManager = null;
  }

  private _syncActivities(): void {
    const pluginManager = this._pluginManager;
    if (!pluginManager) {
      this._activities = [];
      return;
    }

    this._activities = pluginManager.snapshot().activities;
  }

  private _dialogLabel(activity: Owned<PluginActivityRegistration>): PluginLabel | undefined {
    const { label } = activity;
    if (typeof label !== 'function') return label;
    // The router's params belong to whatever is open, so a closed activity sees none.
    const router = this._router;
    try {
      return label(router?.modal === activity.id ? { ...router.params } : {}) || undefined;
    } catch (error) {
      this._log.error(`Plugin "${activity.pluginId}" Activity label() threw an error`, error);
      return undefined;
    }
  }

  public override render() {
    if (this.mode === 'inline') {
      return html`${repeat(
        this._activities,
        (activity) => activity.id,
        (activity) => html`<uc-plugin-activity-host .registration=${activity}></uc-plugin-activity-host>`,
      )}`;
    }

    return html`${repeat(
      this._activities,
      (activity) => activity.id,
      (activity) => html`
        <uc-modal id=${activity.id} dialog-label=${ifDefined(this._dialogLabel(activity))} strokes block-body-scrolling>
          <uc-plugin-activity-host .registration=${activity}></uc-plugin-activity-host>
        </uc-modal>
      `,
    )}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-plugin-activity-host': PluginActivityHost;
    'uc-plugin-activity-renderer': PluginActivityRenderer;
  }
}
