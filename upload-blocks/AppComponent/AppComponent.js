import { State } from '../../symbiote/core/State.js';

export class AppComponent extends HTMLElement {
  static set template(html) {
    this.__tpl = document.createElement('template');
    this.__tpl.innerHTML = html;
  }

  /** 
   * @param {String | DocumentFragment} [template] 
   * @param {Boolean} [shadow]
   */
  render(template, shadow = this.renderShadow) {
    /** @type {DocumentFragment} */
    let fr;
    if (template || this.constructor['__tpl']) {
      while (this.firstChild) {
        this.firstChild.remove();
      }
      if (template?.constructor === DocumentFragment) {
        fr = template;
      } else if (template?.constructor === String) {
        let tpl = document.createElement('template');
        fr = document.importNode(tpl.content, true);
      } else if (this.constructor['__tpl']) {
        fr = document.importNode(this.constructor['__tpl'].content, true);
      }
      this.tplProcessors.forEach((fn) => {
        fn(fr);
      });
    }
    if (shadow) {
      if (!this.shadowRoot) {
        this.attachShadow({
          mode: 'open',
        });
      }
      fr && this.shadowRoot.appendChild(fr);
    } else {
      fr && this.appendChild(fr);
    }
  }

  /** @param {(fr: DocumentFragment) => any} processorFn */
  addTemplateProcessor(processorFn) {
    this.tplProcessors.add(processorFn);
  }

  /** @param {Object<string, any>} init */
  initLocalState(init) {
    this.__localStateInitObj = init;
  }

  constructor() {
    super();
    /** @type {Set<(fr: DocumentFragment) => any>} */
    this.tplProcessors = new Set();
    /** @type {Object<string, HTMLElement>} */
    this.ref = Object.create(null);
    this.allSubs = new Set();
    this.pauseRender = false;
    this.renderShadow = false;
    this.readyToDestroy = true;
  }

  /**
   * @param {DocumentFragment} fr
   * @param {String} attr
   * @param {State} state
   * @param {Set} subs
   */
  static connectToState(fr, attr, state, subs) {
    [...fr.querySelectorAll(`[${attr}]`)].forEach((el) => {
      let subSr = el.getAttribute(attr);
      let keyValsArr = subSr.split(';');
      keyValsArr.forEach((keyValStr) => {
        if (!keyValStr) {
          return;
        }
        let kv = keyValStr.split(':').map((str) => str.trim());
        let prop = kv[0];
        let isAttr;
        if (prop.indexOf('@') === 0) {
          isAttr = true;
          prop = prop.replace('@', '');
        }
        if (state && !state.has(kv[1])) {
          state.add(kv[1], undefined);
        }
        subs.add(
          state.sub(kv[1], (val) => {
            if (isAttr) {
              if (val?.constructor === Boolean) {
                val ? el.setAttribute(prop, '') : el.removeAttribute(prop);
              } else {
                el.setAttribute(prop, val);
              }
            } else {
              el[prop] = val;
            }
          })
        );
      });
      el.removeAttribute(attr);
    });
  }

  get ctxName() {
    return this.getAttribute('ctx-name');
  }

  /** @param {Object<string, any>} stateInit */
  addToAppState(stateInit) {
    if (!this.appState) {
      this.__appSateInit = stateInit;
      return;
    }
    for (let prop in stateInit) {
      if (!this.appState.has(prop)) {
        this.appState.add(prop, stateInit[prop]);
      }
    }
  }

  get appState() {
    return this.ctxName ? State.getNamedCtx(this.ctxName) || State.registerNamedCtx(this.ctxName, this.__appSateInit || {}) : null;
  }

  __initState() {
    if (!this.localState) {
      this.localState = State.registerLocalCtx(this.__localStateInitObj || {});
    }
  }

  connectedCallback() {
    if (this.__disconnectTimeout) {
      window.clearTimeout(this.__disconnectTimeout);
    }
    if (!this.connectedOnce) {
      this.__initChildren = [...this.childNodes];
      this.__initState();
      if (!this.renderShadow) {
        this.addTemplateProcessor((fr) => {
          let slot = fr.querySelector('slot');
          if (!slot) {
            return;
          }
          this.__initChildren.forEach((el) => {
            slot.parentNode.insertBefore(el, slot);
          });
          slot.remove();
        });
      }
      this.addTemplateProcessor((fr) => {
        [...fr.querySelectorAll('[ref]')].forEach((/** @type {HTMLElement} */ el) => {
          let refName = el.getAttribute('ref');
          this.ref[refName] = el;
          el.removeAttribute('ref');
        });
      });
      this.addTemplateProcessor((fr) => {
        AppComponent.connectToState(fr, 'sub', this.localState, this.allSubs);
      });
      this.addTemplateProcessor((fr) => {
        AppComponent.connectToState(fr, 'app', this.appState, this.allSubs);
      });
      if (!this.pauseRender) {
        this.render();
      }
    }
    this.connectedOnce = true;
  }

  disconnectedCallback() {
    if (!this.readyToDestroy) {
      return;
    }
    if (this.__disconnectTimeout) {
      window.clearTimeout(this.__disconnectTimeout);
    }
    this.__disconnectTimeout = window.setTimeout(() => {
      this.allSubs.forEach((sub) => {
        sub.remove();
        this.allSubs.delete(sub);
      });
      this.tplProcessors.forEach((fn) => {
        this.tplProcessors.delete(fn);
      });
    }, 100);
  }

  /**
   * 
   * @param {String} [tagName] 
   * @param {Boolean} [isAlias] 
   */
  static reg(tagName, isAlias = false) {
    if (!tagName) {
      tagName = this.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    }
    if (window.customElements.get(tagName)) {
      console.warn(`${tagName} - is already in custom elements registry`);
      return;
    }
    window.customElements.define(tagName, isAlias ? class extends this {} : this);
    this.__tag = tagName;
  }

  static get is() {
    return this.__tag;
  }

  /**
   * 
   * @param {Object<string, {sub?: Boolean, app?: Boolean, prop?: Boolean}>} desc 
   */
  static bindAttributes(desc) {
    this.observedAttributes = Object.keys(desc);
    this.__attrDesc = desc;
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) {
      return;
    }
    let desc = this.constructor['__attrDesc'][name];
    if (desc.sub) {
      this.__initState();
      this.localState.add(name, newVal);
    }
    if (desc.app) {
      this.addToAppState({name: newVal});
    }
    if (desc.prop) {
      this[name] = newVal;
    }
  }

}
