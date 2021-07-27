import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

export class WidgetBase extends BaseComponent {

  constructor() {
    super();
    this.pauseRender = true;
    this.renderShadow = true;
    this.initLocalState({
      'css-src': '',
    });
  }

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
      this.render();
    };
    this.shadowRoot.appendChild(link);
  }

}

WidgetBase.bindAttributes({
  'css-src': ['property'],
});
