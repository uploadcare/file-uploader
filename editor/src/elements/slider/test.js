import { BaseComponent } from '../../../jsdk/symbiote/core/BaseComponent.js';
import { UploadcareUI } from '../../api/ui.js';
import { SliderUi } from './SliderUi.js';

UploadcareUI.init();

class CtxProvider extends BaseComponent {
  constructor() {
    super();

    this.state = {
      min: -200,
      max: 200,
      defaultValue: -100,
    };
  }
}
CtxProvider.styles = {
  ':host': {
    '--color-text-base': 'black',
    '--color-primary-accent': 'blue',
    width: '190px',
    height: '40px',
    backgroundColor: '#F5F5F5',
    borderRadius: '3px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: '10px',
    paddingRight: '10px',
  },
};
CtxProvider.template = /*html*/ `<${SliderUi.is} set="min: min; max: max: defaultValue: defaultValue"></${SliderUi.is}>`;
window.customElements.define('ctx-provider', CtxProvider);
