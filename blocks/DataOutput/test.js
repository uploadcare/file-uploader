import { DataOutput } from './DataOutput.js';
import { registerBlocks } from '../registerBlocks.js';

registerBlocks({ DataOutput });

const dataOutput = new DataOutput();
dataOutput.classList.add('uc-wgt-common');
dataOutput.setAttribute('console', '');
dataOutput.setAttribute('item-template', /*html*/ `<div>{{test}}</div>`);

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(dataOutput);
  dataOutput.$['*outputData'] = [
    { test: Date.now() },
    { test: Date.now() },
    { test: Date.now() },
    { test: Date.now() },
  ];
};
