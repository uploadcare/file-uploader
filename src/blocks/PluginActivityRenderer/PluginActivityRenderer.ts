import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { createRef, ref } from 'lit/directives/ref.js';
import type {
  Owned,
  PluginActivityDispose,
  PluginActivityRegistration,
} from '../../abstract/managers/plugin';
import { LitActivityBlock,
type ActivityType } from '../../lit/LitActivityBlock';
import { LitBlock } from '../../lit/LitBlock';
import '../Modal/Modal';

export class PluginActivityHost extends LitActivityBlock {
  @property({ attribute: false })
  public registration!: Owned<PluginActivityRegistration>;

  public override activityType: ActivityType = null;

  private _dispose?: PluginActivityDispose;
  private _containerRef = createRef<HTMLDivElement>();

  public override initCallback(): void {
    this.activityType = (this.registration?.id as ActivityType) ?? null;
    super.initCallback();
    this._ensureRegistered();
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('registration')) {
      this._ensureRegistered();
      if (this.isActivityActive) {
        this._disposeActivity();
        this._renderActivity();
      }
    }
  }

  private _ensureRegistered(): void {
    if (!this.registration) {
      return;
    }

    if (this._isActivityRegistered()) {
      return;
    }

    this.registerActivity(this.activityType ?? '', {
      onActivate: () => this._renderActivity(),
      onDeactivate: () => this._disposeActivity(),
    });
  }

  private _renderActivity(): void {
    const container = this._containerRef.value;
    if (!container || !this.registration) {
      return;
    }

    this._disposeActivity();

    this._dispose = this.registration.render(container) ?? undefined;
  }

  private _disposeActivity(): void {
    this._dispose?.();
    this._dispose = undefined;
    const container = this._containerRef.value;
    if (container) {
      container.replaceChildren();
    }
  }

  public override disconnectedCallback(): void {
    this._disposeActivity();
    super.disconnectedCallback();
  }

  public override render() {
    return html`<div ${ref(this._containerRef)}></div>`;
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
