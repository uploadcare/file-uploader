import { AppComponent } from '../AppComponent/AppComponent.js';

export class WidgetBase extends AppComponent {

  constructor() {
    super();
    this.pauseRender = true;
    this.renderShadow = true;
    this.initLocalState({
      'css-src': '',
      ctxName: this.ctxName,
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
  'css-src': {
    prop: true,
  },
});
