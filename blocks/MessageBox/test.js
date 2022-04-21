import { MessageBox, UiMessage } from './MessageBox.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ MessageBox, Icon });

const msgBox = new MessageBox();
msgBox.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(msgBox);
  let msg = new UiMessage();
  msg.caption = 'Test Caption';
  msg.text = 'Some text...';
  msg.isError = true;
  msgBox.$['*message'] = msg;
};
