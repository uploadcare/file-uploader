import { expectType } from 'tsd';
import { GlobalEventPayload } from '..';
import type { EventPayload, UploadCtxProvider } from '../..';

window.addEventListener('LR_DATA_OUTPUT', (e) => {
  expectType<CustomEvent<GlobalEventPayload['LR_DATA_OUTPUT']>>(e);
}, { once: true });

const ctx: UploadCtxProvider = null as unknown as UploadCtxProvider;
ctx.addEventListener(
  'data-output',
  (e) => {
    expectType<CustomEvent<EventPayload['data-output']>>(e);
  }
);
