import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { create } from '../../symbiote/utils/dom-helpers.js';

export class Tabs extends BlockComponent {
  setCurrentTab(tabL10nStr) {
    let ctxList = [...this.ref.context.querySelectorAll('[tab-ctx]')];
    ctxList.forEach((ctxEl) => {
      if (ctxEl.getAttribute('tab-ctx') === tabL10nStr) {
        ctxEl.removeAttribute('hidden');
      } else {
        ctxEl.setAttribute('hidden', '');
      }
    });
  }

  initCallback() {
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
            class: 'tabs',
          },
          properties: {
            onclick: () => {
              this.setCurrentTab(tabL10nStr);
            },
          },
        });
        tabEl.textContent = this.l10n(tabL10nStr);
        this.ref.row.appendChild(tabEl);
      });
    });

    this.defineAccessor('default', (val) => {
      this.setCurrentTab(val);
    });
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
