import './progress-bar.css';
import { html } from '@symbiotejs/symbiote';
import { Block } from '../../abstract/Block';

export class ProgressBar extends Block {
  private _value = 0;

  private _visible = true;

  constructor() {
    super();
    this.init$ = {
      ...this.init$,
      width: 0,
      opacity: 0,
    };
  }

  override initCallback(): void {
    super.initCallback();
    const handleFakeProgressAnimation = (): void => {
      const fakeProgressLine = this.ref.fakeProgressLine as HTMLElement;
      if (!this._visible) {
        fakeProgressLine.classList.add('uc-fake-progress--hidden');
        return;
      }
      if (this._value > 0) {
        fakeProgressLine.classList.add('uc-fake-progress--hidden');
      }
    };

    (this.ref.fakeProgressLine as HTMLElement).addEventListener('animationiteration', handleFakeProgressAnimation);

    this.defineAccessor('value', (value: number | null | undefined) => {
      if (value === undefined || value === null) return;
      this._value = value;
      if (!this._visible) return;
      this.style.setProperty('--l-progress-value', this._value.toString());
    });

    this.defineAccessor('visible', (visible: boolean) => {
      this._visible = visible;
      this.classList.toggle('uc-progress-bar--hidden', !visible);
    });
  }
}

ProgressBar.template = html`
  <div ref="fakeProgressLine" class="uc-fake-progress"></div>
  <div ref="realProgressLine" class="uc-progress"></div>
`;
