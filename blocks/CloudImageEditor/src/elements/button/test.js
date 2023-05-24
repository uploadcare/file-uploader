// @ts-nocheck
/* eslint-disable */
// TODO: remove this test and component in favour of just button tag

import { AppComponent } from '../../lib/AppComponent.js.js';
import { LrBtnUi } from './LrBtnUi.js';

class TestApp extends BlockComponent {
  constructor() {
    super();
    this.init$ = {
      text: 'Button Text',
      icon: 'more',
    };
  }
}
TestApp.template = /* HTML */ `
  <link rel="stylesheet" href="../../css/common.css" />
  <lr-btn-ui reverse set="#text: text; #icon: icon"></lr-btn-ui>
  <div>&nbsp;</div>
  <lr-btn-ui text="One more button..."></lr-btn-ui>
  <div>&nbsp;</div>
`;
TestApp.defineTag('test-app');
