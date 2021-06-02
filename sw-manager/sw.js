self.addEventListener('activate', async (/** @type {ExtendableEvent} */ e) => {
  // @ts-ignore
  e.waitUntil(clients.claim());
});

let KEY = null;

/** @type {{string: *}} */
const sharedCtx = Object.create(null);
const handlers = Object.create(null);
const FETCH_EVENT_NAME = 'fetch';
const registrationIds = [];

self.addEventListener('message', (e) => {
  let msg = e.data;
  if (!KEY && msg.setKey && msg.setKey.constructor === String) {
    KEY = msg.setKey;
  }
  if (!KEY || !msg.key || (msg.key !== KEY)) {
    return;
  }
  if (msg.sharedCtx && msg.sharedCtx.constructor === Object) {
    Object.assign(sharedCtx, msg.sharedCtx);
  }
  if (msg.fnStr && msg.fnStr.constructor === String) {
    /** @type {(swCtx, sharedCtx: Object<string, *>) => *} */
    let fn = new Function('return ' + msg.fnStr)();
    fn(self, sharedCtx);
  }
  if (msg.registerHandler && msg.registerHandler.constructor === Object) {
    let reg = msg.registerHandler;
    if (!reg.type || !reg.handler || !reg.id) {
      console.warn('sw-manager: wrong handler registration request');
      return;
    }
    if (registrationIds.includes(reg.id)) {
      return;
    } else {
      registrationIds.push(reg.id);
    }
    if (!handlers[reg.type]) {
      handlers[reg.type] = new Set();
    }
    let handlerFn = new Function('return ' + reg.handler)();
    handlers[reg.type].add(handlerFn);
  }
});

self.addEventListener(FETCH_EVENT_NAME, (e) => {
  if (handlers[FETCH_EVENT_NAME]) {
    handlers[FETCH_EVENT_NAME].forEach((fn) => {
      fn(e, self, sharedCtx);
    });
  }
});