import { html } from '@symbiotejs/symbiote';
import { Block } from '../../../../../abstract/Block';

export class LineLoaderUi extends Block {
  private _active = false;

  private readonly _handleTransitionEndRight = (): void => {
    const lineEl = this.ref['line-el'] as HTMLElement;
    lineEl.style.transition = 'initial';
    lineEl.style.opacity = '0';
    lineEl.style.transform = 'translateX(-101%)';
    if (this._active) {
      this._start();
    }
  };

  override initCallback(): void {
    super.initCallback();
    this.defineAccessor('active', (active: boolean | undefined) => {
      if (typeof active !== 'boolean') {
        return;
      }
      if (active) {
        this._start();
      } else {
        this._stop();
      }
    });
  }

  private _start(): void {
    this._active = true;
    const { width } = this.getBoundingClientRect();
    const lineEl = this.ref['line-el'] as HTMLElement;
    lineEl.style.transition = 'transform 1s';
    lineEl.style.opacity = '1';
    lineEl.style.transform = `translateX(${width}px)`;
    lineEl.addEventListener('transitionend', this._handleTransitionEndRight, {
      once: true,
    });
  }

  private _stop(): void {
    this._active = false;
  }
}

LineLoaderUi.template = html`
  <div class="uc-inner">
    <div class="uc-line" ref="line-el"></div>
  </div>
`;
