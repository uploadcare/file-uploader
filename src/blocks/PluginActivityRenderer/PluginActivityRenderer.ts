import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import type { Owned, PluginActivityRegistration, PluginRenderDispose } from '../../abstract/managers/plugin';
import { type ActivityType, LitActivityBlock } from '../../lit/LitActivityBlock';
import { LitBlock } from '../../lit/LitBlock';
import '../Modal/Modal';
import './uc-plugin-activity-host.css';

export class PluginActivityHost extends LitActivityBlock {
  @property({ attribute: false })
  public registration!: Owned<PluginActivityRegistration>;

  private _dispose?: PluginRenderDispose;
  private _containerRef = createRef<HTMLDivElement>();
  private _isMounted = false;

  public override initCallback(): void {
    this.activityType = (this.registration?.id as ActivityType) ?? null;
    super.initCallback();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed); // reflects [active] for the current slot

    // Keep activityType in sync if the registration arrives/changes late.
    const id = (this.registration?.id as ActivityType) ?? null;
    if (id !== this.activityType) {
      this.activityType = id;
      if (id) {
        this.setAttribute('activity', id);
      }
    }

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
      this._dispose = this.registration.render(container, this.router.params) ?? undefined;
      this._isMounted = true;
    } catch (error) {
      console.error(`[Plugin "${this.registration.pluginId}"] Activity render() threw an error`, error);
    }
  }

  private _unmount(): void {
    try {
      this._dispose?.();
    } catch (error) {
      console.error(`[Plugin "${this.registration?.pluginId}"] Activity dispose threw an error`, error);
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

export class PluginActivityRenderer extends LitBlock {
  @property({ type: String })
  public mode: 'modal' | 'inline' = 'modal';

  @state()
  private _activities: Owned<PluginActivityRegistration>[] = [];

  private _unsubscribePlugins?: () => void;

  public override initCallback(): void {
    super.initCallback();

    const pluginManager = this._sharedInstancesBag.pluginManager;
    if (pluginManager?.onPluginsChange) {
      this._unsubscribePlugins = pluginManager.onPluginsChange(() => this._syncActivities());
    }

    this._syncActivities();
  }

  private _syncActivities(): void {
    const pluginManager = this._sharedInstancesBag.pluginManager;
    if (!pluginManager) {
      this._activities = [];
      return;
    }

    this._activities = pluginManager.snapshot().activities;

    // Register each activity's declarative navigation edges with the router so
    // `router.traverse('onCancel'|'onDone'|…)` from the activity's UI resolves.
    for (const activity of this._activities) {
      if (activity.routes) {
        this.router.addPluginRoutes(activity.id, activity.routes);
      }
    }
  }

  public override disconnectedCallback(): void {
    this._unsubscribePlugins?.();
    this._unsubscribePlugins = undefined;
    super.disconnectedCallback();
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
        <uc-modal id=${activity.id} strokes block-body-scrolling>
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
