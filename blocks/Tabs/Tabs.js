import { create } from '@symbiotejs/symbiote';
import { Block } from '../../abstract/Block.js';
import { stringToArray } from '../../utils/stringToArray.js';

export class Tabs extends Block {
  /** @param {String} tabL10nStr */
  setCurrentTab(tabL10nStr) {
    if (!tabL10nStr) {
      return;
    }
    const ctxList = [...this.ref.context.querySelectorAll('[tab-ctx]')];
    for (const ctxEl of ctxList) {
      if (ctxEl.getAttribute('tab-ctx') === tabL10nStr) {
        ctxEl.removeAttribute('hidden');
      } else {
        ctxEl.setAttribute('hidden', '');
      }
    }
    for (const lStr in this._tabMap) {
      if (lStr === tabL10nStr) {
        this._tabMap[lStr].setAttribute('current', '');
      } else {
        this._tabMap[lStr].removeAttribute('current');
      }
    }
  }

  initCallback() {
    super.initCallback();
    /**
     * @private
     * @type {Object<string, HTMLElement>}
     */
    this._tabMap = {};
    this.defineAccessor('tab-list', (/** @type {String} */ val) => {
      if (!val) {
        return;
      }
      const tabList = stringToArray(val);
      for (const tabL10nStr of tabList) {
        const tabEl = create({
          tag: 'div',
          attributes: {
            class: 'tab',
          },
          properties: {
            onclick: () => {
              this.setCurrentTab(tabL10nStr);
            },
          },
        });
        tabEl.textContent = this.l10n(tabL10nStr);
        this.ref.row.appendChild(tabEl);
        this._tabMap[tabL10nStr] = tabEl;
      }
    });

    this.defineAccessor('default', (val) => {
      this.setCurrentTab(val);
    });

    if (!this.hasAttribute('default')) {
      this.setCurrentTab(Object.keys(this._tabMap)[0]);
    }
  }
}

Tabs.bindAttributes({
  'tab-list': null,
  default: null,
});

Tabs.template = /* HTML */ `
  <div ref="row" class="tabs-row"></div>
  <div ref="context" class="tabs-context">
    <slot></slot>
  </div>
`;
