import { DICT } from '../../symbiote/core/dictionary.js';
import { extend } from '../../symbiote/core/extend.js';
import { cssTokensExt } from '../../symbiote/extensions/cssTokensExt.js';
import { tagManageExt } from '../../symbiote/extensions/tagManageExt.js';
import { FocusVisible } from './lib/FocusVisible.js';
import { addExternalStyles, applyElementStyles, getCssValue } from '../../symbiote/core/css_utils.js';
import { CfgMngr } from './domain/CfgMngr.js';
import { L10n } from './l10n/L10n.js';
import { UID } from '../../symbiote/utils/UID.js';
import { State } from '../../symbiote/core/State.js';
import { CFG_DEFAULTS } from './domain/CFG_DEFAULTS.js';
import { themeFilter } from './lib/themeFilter.js';
import { ASSETS_STYLES_URL } from './paths.js';

DICT.PROJECT_PREFIX = 'uc';

const EXT_CSS_URL = `${ASSETS_STYLES_URL}/common.css`;
const FLOW_INIT_PROP = 'isFlowInitiator';
const ASYNC_RENDER_INIT_PROP = 'isAsyncRender';
const TOP_LEVEL_PROP = 'isTopLevel';
const CFG_IN_CSS = '--cfg-ctx-name'; // CSS variable

export class AppComponent extends extend(cssTokensExt, tagManageExt) {
  constructor() {
    super();
    if (this.constructor[ASYNC_RENDER_INIT_PROP]) {
      this[ASYNC_RENDER_INIT_PROP] = true;
    }

    if (this.constructor[FLOW_INIT_PROP]) {
      this.uid = UID.generate();
      this.cfgCtx = State.registerNamedCtx(this.uid, {
        ...CFG_DEFAULTS,
        ...CfgMngr.getFormScriptTag(),
        'app:msg': null,
        'app:log': null,
        'app:modal-all-closed': null,
      });
      this.style.setProperty(CFG_IN_CSS, this.uid);
      this.cfgCtx.sub('lang', (lang) => {
        L10n.applyLocale(lang);
      });
      this.cfgCtx.sub('customtranslations', (trMap) => {
        L10n.applyCustom(trMap);
      });
    }
  }

  asyncRender() {
    if (this[ASYNC_RENDER_INIT_PROP]) {
      this[ASYNC_RENDER_INIT_PROP] = false;
      this.connectedCallback();
    }
  }

  get ctxNameFormCss() {
    return getCssValue(this, CFG_IN_CSS);
  }

  get cfgState() {
    let ctxName = this.ctxNameFormCss;
    return this.cfgCtx || (ctxName && State.getNamedCtx(ctxName)) || null;
  }

  readyCallback() {
    if (!this[ASYNC_RENDER_INIT_PROP]) {
      super.readyCallback();
    }
  }

  connectedCallback() {
    if (this[ASYNC_RENDER_INIT_PROP]) {
      return;
    }
    if (this.constructor[FLOW_INIT_PROP]) {
      let elName = this.getAttribute('name');
      if (elName) {
        CfgMngr.registerCfg(elName, this.cfgCtx);
      }
    }

    if (this.constructor[TOP_LEVEL_PROP]) {
      this.style.visibility = 'hidden';
      this.style.opacity = '0';

      addExternalStyles(this, EXT_CSS_URL)
        .then(() => {
          this.style.visibility = 'visible';
          this.style.opacity = '1';
          super.connectedCallback();
          if (this.cfgState) {
            this.cfgState.sub('theme', (theme) => {
              applyElementStyles(this, themeFilter(theme));
            });
          }
          if (this.constructor['renderShadow'] && this.shadowRoot) {
            FocusVisible.register(this.shadowRoot);
          }
        })
        .catch((e) => {
          console.error('Failed to load external style', { error: e, payload: { EXT_CSS_URL } });
          this.style.visibility = 'visible';
          this.style.opacity = '1';
          super.connectedCallback();
        });
    } else {
      super.connectedCallback();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.constructor[FLOW_INIT_PROP]) {
      let elName = this.getAttribute('name');
      if (elName) {
        CfgMngr.unregisterCfg(elName);
      }
      State.clearNamedCtx(this.uid);
    }

    if (this.constructor['renderShadow'] && this.shadowRoot) {
      FocusVisible.unregister(this.shadowRoot);
    }

    for (let [ctxProviderEl, linksMap] of AppComponent.linkedComponentsMap) {
      if (linksMap[this.constructor['is']] && linksMap[this.constructor['is']] === this) {
        delete linksMap[this.constructor['is']];
        if (!Object.keys(linksMap).length) {
          AppComponent.linkedComponentsMap.delete(ctxProviderEl);
        }
      }
    }
  }

  /**
   * @param {HTMLElement} ctxProviderEl
   * @param {Boolean} [putToParent]
   */
  static openFor(ctxProviderEl, putToParent = false) {
    if (!this.linkedComponentsMap.has(ctxProviderEl)) {
      this.linkedComponentsMap.set(ctxProviderEl, Object.create(null));
    }
    let linksMap = this.linkedComponentsMap.get(ctxProviderEl);
    if (!linksMap[this.is]) {
      let ClassDef = window.customElements.get(this.is);
      let newComponent = new ClassDef();
      newComponent.dataCtxProvider = ctxProviderEl;
      (putToParent ? ctxProviderEl.parentElement : document.body).appendChild(newComponent);
      linksMap[this.is] = newComponent;
    }
    let el = linksMap[this.is];
    let providerFlowUid = getCssValue(ctxProviderEl, CFG_IN_CSS);
    el.style.setProperty(CFG_IN_CSS, providerFlowUid);
    el.cfgCtx = ctxProviderEl['cfgState'];
    return el;
  }

  /**
   * @param {HTMLElement} ctxProviderEl
   * @param {Boolean} [putToParent]
   */
  static toggleFor(ctxProviderEl, putToParent = false) {
    let linksMap = this.linkedComponentsMap.get(ctxProviderEl);
    if (linksMap && linksMap[this.is]) {
      let component = linksMap[this.is];
      if (typeof component.toggle === 'function') {
        component.toggle();
      } else {
        component.remove();
      }
    } else {
      this.openFor(ctxProviderEl, putToParent);
    }
  }

  /** @param {Boolean} val */
  static topLevel(val) {
    this.renderShadow = val;
    this[TOP_LEVEL_PROP] = val;
  }

  /** @param {Boolean} val */
  static flowInitiator(val) {
    this[FLOW_INIT_PROP] = val;
  }

  /** @param {Boolean} val */
  static asyncRender(val) {
    this[ASYNC_RENDER_INIT_PROP] = val;
  }
}
AppComponent.linkedComponentsMap = new Map();
