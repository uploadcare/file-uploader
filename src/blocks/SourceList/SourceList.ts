import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { LitBlock } from '../../lit/LitBlock';
import { browserFeatures } from '../../utils/browser-info';
import { deserializeCsv } from '../../utils/comma-separated';
import { stringToArray } from '../../utils/stringToArray';

export class SourceList extends LitBlock {
  private _rawSourceList: string[] = [];
  private _cameraModes: string[] = [];
  private _resolvedSources: string[] = [];

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
    const resolvedSources: string[] = [];

    for (const srcName of this._rawSourceList) {
      if (srcName === 'instagram') {
        console.error(
          "Instagram source was removed because the Instagram Basic Display API hasn't been available since December 4, 2024. " +
            'Official statement, see here:' +
            'https://developers.facebook.com/blog/post/2024/09/04/update-on-instagram-basic-display-api/?locale=en_US',
        );
        continue;
      }

      if (srcName === 'camera' && browserFeatures.htmlMediaCapture) {
        const cameraSources = this._cameraModes.length
          ? this._cameraModes.map((mode) => `mobile-${mode}-camera`)
          : ['mobile-photo-camera'];

        resolvedSources.push(...cameraSources);
        continue;
      }

      resolvedSources.push(srcName);
    }

    this.sources = resolvedSources;
  }

  @state()
  private sources: string[] = [];

  public override render() {
    return html`${this.sources.map((type) => html`<uc-source-btn role="listitem" type=${type}></uc-source-btn>`)}`;
  }
}
