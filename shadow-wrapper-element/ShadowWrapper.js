import { applyStyles } from '../lib/applyStyles.js';
import { createElement } from '../lib/createElement.js';

const STYLES = {
  display: 'contents',
};

export class ShadowWrapper extends HTMLElement {
  static get EVENT() {
    return {
      CSS_READY: '__shadow-css-ready',
      CSS_ERROR: '__shadow-css-error',
      CREATED: '__shadow-wrapper-created',
      CONNECTED: '__shadow-wrapper-connected',
      DISCONNECTED: '__shadow-wrapper-disconnected',
    };
  }

  static get observedAttributes() {
    return ['css-src'];
  }

  _notify(eventType) {
    window.dispatchEvent(
      new CustomEvent(eventType, {
        detail: {
          dispatcher: this,
          name: this.getAttribute('name'),
        },
      })
    );
  }

  _moveToShadow() {
    [...this.shadowRoot.children].forEach((el) => {
      if (el !== this.styleLink) {
        el.remove();
      }
    });
    while (this.firstChild) {
      this.shadowRoot.appendChild(this.firstChild);
    }
  }

  constructor() {
    super();
    this.attachShadow({
      mode: 'open',
    });
    /** @type {HTMLLinkElement} */
    // @ts-ignore
    this.styleLink = createElement('link', {
      rel: 'stylesheet',
      type: 'text/css',
    });
    this.shadowRoot.appendChild(this.styleLink);
    this.mutationObserver = new MutationObserver(() => {
      this._moveToShadow();
    });
    this._notify(ShadowWrapper.EVENT.CREATED);
  }

  connectedCallback() {
    this._moveToShadow();
    this.mutationObserver.observe(this, {
      subtree: true,
      characterData: true,
    });
    ShadowWrapper.activeInstances.add(this);
    this._notify(ShadowWrapper.EVENT.CONNECTED);
  }

  attributeChangedCallback(name, oldVal, newVal) {
    this.styleLink.href = newVal;
    this.styleLink.onload = () => {
      applyStyles(this, STYLES);
      this.removeAttribute('hidden');
      this._notify(ShadowWrapper.EVENT.CSS_READY);
    };
    this.styleLink.onerror = () => {
      this._notify(ShadowWrapper.EVENT.CSS_ERROR);
    };
  }

  disconnectedCallback() {
    this.mutationObserver.disconnect();
    ShadowWrapper.activeInstances.delete(this);
    this._notify(ShadowWrapper.EVENT.DISCONNECTED);
  }
}

ShadowWrapper.activeInstances = new Set();
