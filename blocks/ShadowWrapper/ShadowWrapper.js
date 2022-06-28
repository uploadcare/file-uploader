import { BaseComponent } from '@symbiotejs/symbiote';

const CSS_ATTRIBUTE = 'css-src';

export class ShadowWrapper extends BaseComponent {
  pauseRender = true;

  initCallback() {
    let href = this.getAttribute(CSS_ATTRIBUTE);
    if (href) {
      this.renderShadow = true;
      this.attachShadow({
        mode: 'open',
      });
      let link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = href;
      link.onload = () => {
        // CSS modules can be not loaded at this moment
        // TODO: investigate better solution
        window.requestAnimationFrame(() => {
          this.render();
        });
      };
      this.shadowRoot.appendChild(link);
    } else {
      this.render();
    }
  }
}
