import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ChildBlock } from '../../lit/ChildBlock';
import { UID } from '../../utils/UID';
import { CameraActionEvent, type CameraSetting } from './CameraActionEvent';
import '../Icon/Icon';
import './camera-settings.css';

export type CameraSettingOption = { text: string; value: string; icon?: TemplateResult };

/** One section of the settings popup: a device picker or a capture setting, with its options and the value in effect. */
export type CameraSettingSection = {
  key: 'camera' | 'microphone' | CameraSetting;
  label: string;
  hidden: boolean;
  options: CameraSettingOption[];
  value: string;
  disabled?: boolean;
};

/**
 * The settings button of the camera's bottom bar and the popup it opens: an accordion with one section per setting,
 * each a row with its label and current value that opens onto radio options. One section is open at a time.
 */
export class CameraSettings extends ChildBlock {
  @property({ type: Boolean, attribute: false })
  public buttonHidden = true;

  @property({ attribute: false })
  public sections: CameraSettingSection[] = [];

  private readonly _popoverId = `uc-camera-settings-${UID.generateFastUid()}`;

  private readonly _emit = (action: CameraActionEvent['action']) => this.dispatchEvent(new CameraActionEvent(action));

  private _handleChange(key: CameraSettingSection['key'], event: Event): void {
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

  /**
   * The sections share a `name`, so opening one closes the others. A lone section is always open, its heading hidden;
   * any other disabled section is shut and stays shut, its value still on show.
   */
  private _renderSection(section: CameraSettingSection, lone: boolean) {
    const { key, label, hidden, options, value, disabled = false } = section;
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
          <span class="uc-camera-setting-value">${current?.text ?? ''}</span>
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
                ${option.icon ?? nothing}
                <span>${option.text}</span>
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
    'uc-camera-settings': CameraSettings;
  }
}
