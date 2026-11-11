import { html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ChildBlock } from '../../../lit/ChildBlock';
import { UID } from '../../../utils/UID';
import { renderAspectRatioSvg } from '../../Icon/aspectRatioIcon';
import { CameraActionEvent } from './CameraActionEvent';
import type { SettingOptionData, SettingSectionData } from './settingsView';
import '../../Icon/Icon';
import './camera-settings.css';

/**
 * The settings button of the camera's bottom bar and the popup it opens: an accordion with one section per setting,
 * each a row with its label and current value that opens onto radio options. One section is open at a time.
 */
export class CameraSettingsPopup extends ChildBlock {
  @property({ type: Boolean, attribute: false })
  public buttonHidden = true;

  @property({ attribute: false })
  public sections: SettingSectionData[] = [];

  /** The camera's own shape as the preview shows it, which the native ratio's icon draws. */
  @property({ attribute: false })
  public previewShape: { width: number; height: number } | null = null;

  private readonly _popoverId = `uc-camera-settings-${UID.generateFastUid()}`;

  private readonly _emit = (action: CameraActionEvent['action']) => this.dispatchEvent(new CameraActionEvent(action));

  private _handleChange(key: SettingSectionData['key'], event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value;
    if (!value) return;
    if (key === 'camera') {
      this._emit({ type: 'select-camera', deviceId: value });
    } else if (key === 'microphone') {
      this._emit({ type: 'select-microphone', deviceId: value });
    } else {
      this._emit({ type: 'pick-setting', setting: key, value });
    }
  }

  /** Clicks and Enter or Space alike reach the summary as a click; a disabled section doesn't open. */
  private readonly _handleToggle = (event: Event): void => {
    if ((event.currentTarget as HTMLElement).ariaDisabled === 'true') {
      event.preventDefault();
    }
  };

  // Muting while the microphone section is open shuts it, unless it is the only one; the `open` binding only covers
  // that one.
  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    for (const section of this.querySelectorAll<HTMLDetailsElement>(
      '.uc-camera-setting.uc-disabled:not(.uc-lone)[open]',
    )) {
      section.open = false;
    }
  }

  private _text(option: SettingOptionData | undefined): string {
    return option?.textKey ? this.l10n(option.textKey) : (option?.text ?? '');
  }

  /** The shape of a ratio option; the native one takes the camera's, once its first frame is in. */
  private _icon({ shape }: SettingOptionData) {
    const size = shape === 'native' ? this.previewShape : shape && { width: shape, height: 1 };
    return size ? html`<uc-icon>${renderAspectRatioSvg(size.width, size.height)}</uc-icon>` : nothing;
  }

  /**
   * The sections share a `name`, so opening one closes the others. A lone section is always open, its heading hidden;
   * any other disabled section is shut and stays shut, its value still on show.
   */
  private _renderSection(section: SettingSectionData, lone: boolean) {
    const { key, labelKey, hidden, options, value, disabled = false } = section;
    const label = this.l10n(labelKey);
    const current = options.find((option) => option.value === value);
    return html`
      <details
        class=${classMap({ 'uc-camera-setting': true, 'uc-disabled': disabled, 'uc-lone': lone })}
        data-setting=${key}
        name=${this._popoverId}
        ?open=${lone}
        ?hidden=${hidden}
      >
        <summary aria-disabled=${disabled ? 'true' : 'false'} @click=${this._handleToggle}>
          <span>${label}</span>
          <span class="uc-camera-setting-value">${this._text(current)}</span>
          <uc-icon class="uc-camera-setting-chevron" name="arrow-dropdown"></uc-icon>
        </summary>
        <div class="uc-camera-setting-options" role="radiogroup" aria-label=${label}>
          ${options.map(
            (option) => html`
              <label class="uc-camera-setting-option">
                <input
                  type="radio"
                  name=${`${this._popoverId}-${key}`}
                  value=${option.value}
                  .checked=${option.value === value}
                  ?disabled=${disabled}
                  @change=${(event: Event) => this._handleChange(key, event)}
                />
                ${this._icon(option)}
                <span>${this._text(option)}</span>
              </label>
            `,
          )}
        </div>
      </details>
    `;
  }

  public override render() {
    const visible = this.sections.filter((section) => !section.hidden).length;
    return html`
      <button
        type="button"
        class="uc-mini-btn uc-camera-settings-btn"
        popovertarget=${this._popoverId}
        title=${this.l10n('camera-settings')}
        aria-label=${this.l10n('camera-settings')}
        ?hidden=${this.buttonHidden}
      >
        <uc-icon name="settings"></uc-icon>
      </button>
      <div id=${this._popoverId} class="uc-camera-settings" popover="auto">
        ${this.sections.map((section) => this._renderSection(section, !section.hidden && visible === 1))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-camera-settings': CameraSettingsPopup;
  }
}
