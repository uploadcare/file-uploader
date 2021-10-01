import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

export class ShadowWrapper extends BaseComponent {
  init$ = {
    'css-src': '',
  };

  pauseRender = true;
  renderShadow = true;

  set 'css-src'(val) {
    if (!val) {
      return;
    }
    this.attachShadow({
      mode: 'open',
    });
    let link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = val;
    link.onload = () => {
      // CSS modules can be not loaded at this moment
      // TODO: investigate better solution
      window.requestAnimationFrame(() => {
        this.render();
      });
    };
    this.shadowRoot.appendChild(link);
  }
}

ShadowWrapper.bindAttributes({
  'css-src': null,
});
