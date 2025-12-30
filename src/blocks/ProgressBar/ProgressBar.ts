import './progress-bar.css';
import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { LitBlock } from '../../lit/LitBlock';

export class ProgressBar extends LitBlock {
  @property({ type: Number })
  public value = 0;

  @property({ type: Boolean, reflect: true })
  public visible = true;

  private _progressValue = 0;

  private readonly _fakeProgressLineRef = createRef<HTMLDivElement>();

  private readonly _handleFakeProgressAnimation = (): void => {
    const fakeProgressLine = this._fakeProgressLineRef.value;
    if (!fakeProgressLine) {
      return;
    }

    if (!this.visible) {
      fakeProgressLine.classList.add('uc-fake-progress--hidden');
      return;
    }

    if (this._progressValue > 0) {
      fakeProgressLine.classList.add('uc-fake-progress--hidden');
    }
  };

  protected override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);

    this._progressValue = this._normalizeProgressValue(this.value);
    this._updateProgressValueStyle();
    this._fakeProgressLineRef.value?.addEventListener('animationiteration', this._handleFakeProgressAnimation);
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('value')) {
      const normalizedValue = this._normalizeProgressValue(this.value);

      if (!this.visible) {
        this._progressValue = normalizedValue;
      } else {
        const nextValue = Math.max(this._progressValue, normalizedValue);
        if (nextValue !== this._progressValue) {
          this._progressValue = nextValue;
          this._updateProgressValueStyle();
        }
      }
    }

    if (changedProperties.has('visible')) {
      this.classList.toggle('uc-progress-bar--hidden', !this.visible);
      if (this.visible) {
        this._updateProgressValueStyle();
      } else {
        this._progressValue = this._normalizeProgressValue(this.value);
      }
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._fakeProgressLineRef.value?.removeEventListener('animationiteration', this._handleFakeProgressAnimation);
  }

  private _normalizeProgressValue(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(100, Math.max(0, value));
  }

  private _updateProgressValueStyle(): void {
    if (!this.visible) {
      return;
    }
    this.style.setProperty('--l-progress-value', this._progressValue.toString());
  }

  public override render() {
    return html`
      <div ${ref(this._fakeProgressLineRef)} class="uc-fake-progress"></div>
      <div class="uc-progress"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-progress-bar': ProgressBar;
  }
}
