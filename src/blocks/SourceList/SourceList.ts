import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { PluginSourceRegistration } from '../../abstract/managers/plugin';
import { browserFeatures } from '../../utils/browser-info';
import { deserializeCsv } from '../../utils/comma-separated';
import { stringToArray } from '../../utils/stringToArray';
import { ExternalUploadSource, UploadSource, UploadSourceMobile } from '../../utils/UploadSource';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import '../SourceBtn/SourceBtn';
import type { RegisteredActivityType } from '../../lit/LitActivityBlock';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';

export class SourceList extends LitUploaderBlock {
  private _rawSourceList: string[] = [];
  private _cameraModes: string[] = [];
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

    this.subConfigValue('cameraModes', (cameraModesValue: string) => {
      this._cameraModes = deserializeCsv(cameraModesValue);
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

    this._rawSourceList.forEach((srcName, index) => {
      const expanded = this._expandSource(srcName);

      // If expansion returned different entries (e.g., camera -> mobile modes), resolve them as built-ins
      const expandedDiffer = expanded.length !== 1 || expanded[0] !== srcName;
      if (expandedDiffer) {
        for (const name of expanded) {
          const config = this._makeBuiltInSourceConfig(name);
          if (config) {
            sources.push(config);
          }
        }
        return;
      }

      const builtInConfig = this._makeBuiltInSourceConfig(srcName);
      if (builtInConfig) {
        sources.push(builtInConfig);
        return;
      }

      const pluginSource = pluginSourceById.get(srcName);
      if (pluginSource) {
        sources.push(this._makePluginSourceConfig(pluginSource));
      }
    });

    this._sources = sources;
  }

  private _expandSource(srcName: string): string[] {
    if (srcName === 'instagram') {
      console.error(
        "Instagram source was removed because the Instagram Basic Display API hasn't been available since December 4, 2024. " +
          'Official statement, see here: ' +
          'https://developers.facebook.com/blog/post/2024/09/04/update-on-instagram-basic-display-api/?locale=en_US',
      );
      return [];
    }

    if (srcName === 'camera' && browserFeatures.htmlMediaCapture) {
      const cameraSources = this._cameraModes.length
        ? this._cameraModes.map((mode) => `mobile-${mode}-camera`)
        : ['mobile-photo-camera'];

      return cameraSources;
    }

    return [srcName];
  }

  private _makeBuiltInSourceConfig(type: string): SourceButtonConfig | null {
    switch (type) {
      case UploadSource.LOCAL:
        return {
          id: type,
          label: `src-type-${type}`,
          icon: type,
          onClick: () => this.api.openSystemDialog(),
        };
      // case UploadSource.URL:
      //   return {
      //     id: type,
      //     label: 'src-type-from-url',
      //     icon: type,
      //     onClick: () => this._openActivity('url'),
      //   };
      case UploadSource.CAMERA:
        return {
          id: type,
          label: `src-type-${type}`,
          icon: type,
          onClick: () => this._openActivity('camera'),
        };
      case 'draw':
        return {
          id: type,
          label: 'src-type-draw',
          icon: 'edit-draw',
          onClick: () => this._openActivity('draw'),
        };
      default:
        break;
    }

    if (Object.values(UploadSourceMobile).includes(type)) {
      const isPhoto = type === 'mobile-photo-camera';
      return {
        id: type,
        label: 'src-type-camera',
        icon: UploadSource.CAMERA,
        onClick: () => {
          const supportsCapture = browserFeatures.htmlMediaCapture;
          if (supportsCapture) {
            this.api.openSystemDialog({
              captureCamera: true,
              modeCamera: isPhoto ? 'photo' : 'video',
            });
            return;
          }
          this._openActivity('camera');
        },
      };
    }

    if (Object.values(ExternalUploadSource).includes(type)) {
      return {
        id: type,
        label: `src-type-${type}`,
        icon: type,
        onClick: () =>
          this._openActivity('external', {
            externalSourceType: type,
          }),
      };
    }

    return null;
  }

  private _makePluginSourceConfig(source: PluginSourceRegistration): SourceButtonConfig {
    return {
      id: source.id,
      label: source.label,
      icon: source.icon,
      onClick: () => source.onSelect(),
    };
  }

  private _openActivity(activityId: RegisteredActivityType | null, params: Record<string, unknown> = {}): void {
    if (!activityId) {
      this.modalManager?.closeAll();
      this.set$({
        '*currentActivityParams': {},
        '*currentActivity': null,
      });
      return;
    }

    this.modalManager?.open(activityId);
    this.set$({
      '*currentActivityParams': params,
      '*currentActivity': activityId,
    });
  }

  public override render() {
    return html`${this._sources.map((source) => html`<uc-source-btn role="listitem" .source=${source}></uc-source-btn>`)}`;
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
