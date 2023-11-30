import { expectType } from 'tsd';
import { GlobalEventPayload } from '../index.js';

window.addEventListener(
  'LR_DATA_OUTPUT',
  (e) => {
    expectType<CustomEvent<GlobalEventPayload['LR_DATA_OUTPUT']>>(e);
  },
  { once: true }
);
