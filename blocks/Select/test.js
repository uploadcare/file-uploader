import { Select } from './Select.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

if (!window.location.host) {
  registerBlocks({ Select, Icon });

  /** @type {Select} */
  let select = document.querySelector(Select.is);
  select.$.options = [
    {
      text: 'Option 1',
      value: 1,
    },
    {
      text: 'Option 2',
      value: 2,
    },
    {
      text: 'Option 3',
      value: 3,
    },
  ];

  select.onchange = (e) => {
    console.log(e);
    console.log(select.value);
  };
}
