import { AppComponent } from '../../lib/AppComponent.js';
import { UcBtnUi } from './UcBtnUi.js';

class TestApp extends BlockComponent {
  constructor() {
    super();
    this.init$ = {
      text: 'Button Text',
      icon: 'more',
    };
  }
}
TestApp.template = /*html*/ `
<link rel="stylesheet" href="../../css/common.css">
<uc-btn-ui reverse set="#text: text; #icon: icon"></uc-btn-ui>
<div>&nbsp;</div>
<uc-btn-ui text="One more button..."></uc-btn-ui>
<div>&nbsp;</div>
`;
TestApp.defineTag('test-app');
