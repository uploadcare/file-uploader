import { html, LitElement, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import '../../blocks/ProgressBar/progress-bar.css';
import { LightDomMixin } from '../../lit/LightDomMixin';

/**
 * v2 `<uc-progress-bar>`. Stateless display element driven by `value`
 * (0-100) + `visible` (boolean) attributes. v1's `progress-bar.css`
 * targets this tag name so visuals are inherited.
 *
 * Mechanics ported verbatim from v1:
 *  - monotonic progress (never moves backward while visible)
 *  - fake-progress overlay animation that fades once a real value arrives
 *  - resets progress to the current value when hidden
 */
export class ProgressBar extends LightDomMixin(LitElement) {
  @property({ type: Boolean, noAccessor: true })
  public hasFileName = false;

  @property({ type: Number })
  public value = 0;

  @property({ type: Boolean, reflect: true })
  public visible = true;

  private _progressValue = 0;
  private readonly _fakeProgressLineRef = createRef<HTMLDivElement>();

  private readonly _handleFakeProgressAnimation = (): void => {
    const line = this._fakeProgressLineRef.value;
    if (!line) return;
    if (!this.visible || this._progressValue > 0) {
      line.classList.add('uc-fake-progress--hidden');
    }
  };

  protected override firstUpdated(changed: PropertyValues<this>): void {
    super.firstUpdated(changed);
    this._progressValue = this._clamp(this.value);
    this._setStyle();
    this._fakeProgressLineRef.value?.addEventListener('animationiteration', this._handleFakeProgressAnimation);
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (changed.has('value')) {
      const next = this._clamp(this.value);
      if (!this.visible) {
        this._progressValue = next;
      } else if (next > this._progressValue) {
        this._progressValue = next;
        this._setStyle();
      }
    }
    if (changed.has('visible')) {
      this.classList.toggle('uc-progress-bar--hidden', !this.visible);
      if (this.visible) this._setStyle();
      else this._progressValue = this._clamp(this.value);
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._fakeProgressLineRef.value?.removeEventListener('animationiteration', this._handleFakeProgressAnimation);
  }

  private _clamp(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
  }

  private _setStyle(): void {
    if (!this.visible) return;
    this.style.setProperty('--l-progress-value', this._progressValue.toString());
  }

  public override render() {
    return html`
      <div ${ref(this._fakeProgressLineRef)} class="uc-fake-progress"></div>
      <div class="uc-progress"></div>
    `;
  }
}

if (!customElements.get('uc-progress-bar')) customElements.define('uc-progress-bar', ProgressBar);
