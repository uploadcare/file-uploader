import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { PluginSourceRegistration } from '../../abstract/managers/plugin';
import { stringToArray } from '../../utils/stringToArray';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import '../SourceBtn/SourceBtn';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';

export class SourceList extends LitUploaderBlock {
  private _rawSourceList: string[] = [];
  private _unsubscribePlugins?: () => void;

  @state()
  private _sources: SourceButtonConfig[] = [];

  /**
   * CSS-only attribute
   */
  @property({ type: Boolean, attribute: 'wrap', noAccessor: true })
  public wrap = false;

  public override initCallback(): void {
    super.initCallback();

    this.subConfigValue('sourceList', (val: string) => {
      this._rawSourceList = stringToArray(val);
      this._updateSources();
    });

    const pluginManager = this._sharedInstancesBag.pluginManager;
    if (pluginManager?.onPluginsChange) {
      this._unsubscribePlugins = pluginManager.onPluginsChange(() => this._updateSources());
    }
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (this.cfg.sourceListWrap) {
      this.style.removeProperty('display');
    } else {
      this.style.display = 'contents';
    }
  }

  private _updateSources(): void {
    const pluginManager = this._sharedInstancesBag.pluginManager;
    const pluginSources = pluginManager?.snapshot().sources ?? [];
    const pluginSourceById = new Map(pluginSources.map((source) => [source.id, source]));

    const sources: SourceButtonConfig[] = [];

    this._rawSourceList.forEach((srcName) => {
      const expanded = this._expandSource(srcName, pluginSourceById);

      // If expansion returned different entries (e.g., camera -> mobile modes), resolve them
      const expandedDiffer = expanded.length !== 1 || expanded[0] !== srcName;
      if (expandedDiffer) {
        for (const name of expanded) {
          const pluginSource = pluginSourceById.get(name);
          if (pluginSource) {
            sources.push(this._makePluginSourceConfig(pluginSource));
          }
        }
        return;
      }

      const pluginSource = pluginSourceById.get(srcName);
      if (pluginSource) {
        sources.push(this._makePluginSourceConfig(pluginSource));
      }
    });

    this._sources = sources;
  }

  private _expandSource(srcName: string, pluginSourceById: Map<string, PluginSourceRegistration>): string[] {
    const pluginSource = pluginSourceById.get(srcName);
    if (pluginSource?.expand) {
      return pluginSource.expand();
    }

    return [srcName];
  }

  private _makePluginSourceConfig(source: PluginSourceRegistration): SourceButtonConfig {
    return {
      id: source.id,
      label: source.label,
      icon: source.icon,
      onClick: () => source.onSelect(),
    };
  }

  public override render() {
    return html`${this._sources.map((source) => html`<uc-source-btn role="listitem" .source=${source} data-source-id=${source.id}></uc-source-btn>`)}`;
  }

  public override disconnectedCallback(): void {
    this._unsubscribePlugins?.();
    this._unsubscribePlugins = undefined;
    super.disconnectedCallback();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-source-list': SourceList;
  }
}
