import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import type { RouterController } from '../../abstract/controllers/RouterController';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import type {
  Owned,
  PluginActivityRegistration,
  PluginController,
  PluginRenderDispose,
} from '../../abstract/managers/plugin';
import { ActivityChildBlock } from '../../lit/ActivityChildBlock';
import type { ActivityType } from '../../lit/activity-constants';
import { ChildBlock } from '../../lit/ChildBlock';
import '../Modal/Modal';
import './uc-plugin-activity-host.css';

export class PluginActivityHost extends ActivityChildBlock {
  @property({ attribute: false })
  public registration!: Owned<PluginActivityRegistration>;

  private _dispose?: PluginRenderDispose;
  private _containerRef = createRef<HTMLDivElement>();
  private _isMounted = false;

  /** Test-only public surface (`plugin-activity-host.e2e.test.tsx`) mirroring v1's `LitBlock.router` getter. */
  public get router(): RouterController {
    return this.bag.router;
  }

  protected override controllerReady(ctrl: UploaderController): void {
    this.activityType = (this.registration?.id as ActivityType) ?? null;
    super.controllerReady(ctrl);
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
      // Move the mounted-activity signal from the stale id to the new one so
      // API waits (navigate/setModalState) find this host under its current
      // activityType right away, rather than after the next render cycle.
      this.reportActivityMounted();
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
      this._dispose = this.registration.render(container, this.bag.router.params) ?? undefined;
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

export class PluginActivityRenderer extends ChildBlock {
  @property({ type: String })
  public mode: 'modal' | 'inline' = 'modal';

  @state()
  private _activities: Owned<PluginActivityRegistration>[] = [];

  // Transiently null until the shared PluginController registers (bag.when) —
  // render falls back to an empty activity list meanwhile (Icon/FileItem precedent).
  private _pluginManager: PluginController | null = null;

  protected override controllerReady(): void {
    this.trackSub(
      this.bag.when('pluginManager', (pluginManager) => {
        this._pluginManager = pluginManager;
        this.trackSub(pluginManager.onPluginsChange(() => this._syncActivities()));
        this._syncActivities();
      }),
    );
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
