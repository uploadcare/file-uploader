import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { create } from '../../symbiote/utils/dom-helpers.js';

export class Tabs extends BlockComponent {
  /** @param {String} tabL10nStr */
  setCurrentTab(tabL10nStr) {
    if (!tabL10nStr) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: {
          tab: tabL10nStr,
        },
      })
    );
    let ctxList = [...this.ref.context.querySelectorAll('[tab-ctx]')];
    ctxList.forEach((ctxEl) => {
      if (ctxEl.getAttribute('tab-ctx') === tabL10nStr) {
        ctxEl.removeAttribute('hidden');
      } else {
        ctxEl.setAttribute('hidden', '');
      }
    });
    for (let lStr in this._tabMap) {
      if (lStr === tabL10nStr) {
        this._tabMap[lStr].setAttribute('current', '');
      } else {
        this._tabMap[lStr].removeAttribute('current');
      }
    }
  }

  initCallback() {
    /** @type {Object<string, HTMLElement>} */
    this._tabMap = {};
    this.defineAccessor('tab-list', (/** @type {String} */ val) => {
      if (!val) {
        return;
      }
      let tabList = val.split(',').map((tabName) => {
        return tabName.trim();
      });
      tabList.forEach((tabL10nStr) => {
        let tabEl = create({
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
      });
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
  'tab-list': ['property'],
  default: ['property'],
});

Tabs.template = /*html*/ `
<div ref="row" .tabs-row></div>
<div ref="context" .tabs-context>
  <slot></slot>
</div>
`;
