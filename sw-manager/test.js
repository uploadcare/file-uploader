import { registerSw, callSwFunction, registerHandler, publishSharedCtx } from './sw-manager.js';

// blob: - protocol is not supported for SW
let swKey = await registerSw('./sw.js', './');

publishSharedCtx(
  {
    myProp: 'some value',
  },
  swKey
);

callSwFunction((ctx, shared) => {
  console.log('Hello from Service Worker!');
  console.log(ctx);
  console.log(shared);

  // You cannot add first 'fetch' listener from here.
  // This will work only if SW already have 'fetch' listener.
  // Yes, that's strange... (checked in Chrome)
  ctx.addEventListener('fetch', (e) => {
    console.log(shared.myProp);
  });
}, swKey);

registerHandler(
  'fetch',
  'my_handler',
  (e, ctx, shared) => {
    console.log(e);
  },
  swKey
);

window.setInterval(async () => {
  window.fetch('./test.html');
}, 4000);

console.log(swKey);
