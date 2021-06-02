import {registerSw, callSwFunction, registerHandler} from './sw-manager.js';

let swKey = await registerSw('./sw.js', './');

callSwFunction((ctx, shared) => {
  console.log('Hello from Service Worker!');
  console.log(ctx);
  console.log(shared);

  // You cannot add 'fetch' listener from here.
  // This will not work:
  ctx.addEventListener('fetch', (e) => {
    // console.log(e);
  });
}, swKey);

registerHandler('fetch', 'my_handler', (e, ctx, shared) => {
  console.log(e);
}, swKey);

window.setInterval(async () => {
  window.fetch('./test.html');
}, 4000);

console.log(swKey);
