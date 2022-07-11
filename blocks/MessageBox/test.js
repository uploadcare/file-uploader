import { ifRef } from '../../utils/ifRef.js';
import { MessageBox, UiMessage } from './MessageBox.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ MessageBox, Icon });
  /** @type {MessageBox} */
  const msgBox = document.querySelector(MessageBox.is);
  let msg = new UiMessage();
  msg.caption = 'Test Caption';
  msg.text = 'Some text...';
  msg.isError = true;
  msgBox.$['*message'] = msg;
});
