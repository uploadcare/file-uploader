import { AppComponent } from '../../lib/AppComponent.js';
import { UcBtnUi } from './UcBtnUi.js';

class TestApp extends AppComponent {
  constructor() {
    super();
    this.state = {
      text: 'Button Text',
      icon: 'more',
    };
  }
}
TestApp.renderShadow = true;
TestApp.template = /*html*/ `
<link rel="stylesheet" href="../../css/common.css">
<${UcBtnUi.is} reverse set="#text: text; #icon: icon"></${UcBtnUi.is}>
<div>&nbsp;</div>
<${UcBtnUi.is} text="One more button..."></${UcBtnUi.is}>
<div>&nbsp;</div>
`;
TestApp.defineTag('test-app');
