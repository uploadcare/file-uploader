function generateSwKey() {
  return [...btoa(Date.now().toString()).replaceAll('=', '')].sort().join('');
}

/**
 * 
 * @param {String} swPath 
 * @param {String} scope 
 * @param {String} [key]
 * @returns {Promise<String>}
 */
export function registerSw(swPath, scope, key = generateSwKey()) {
  let swState = 'activated';
  return new Promise(async (resolve, reject) => {
    if (!navigator.serviceWorker) {
      reject(null);
      return;
    }
    await navigator.serviceWorker.register(swPath, {
      scope,
    });
    let swr = await navigator.serviceWorker.ready;
    if (swr.active.state === swState) {
      swr.active.postMessage({
        setKey: key,
      });
      resolve(key);
    } else {
      swr.active.onstatechange = () => {
        if (swr.active.state === swState) {
          swr.active.postMessage({
            setKey: key,
          });
          resolve(key);
        }
      }
    }
  });
}

/**
 * 
 * @param {(swCtx: ServiceWorkerGlobalScope, sharedCtx: Object<string, *>) => *} swFunction
 * @param {String} key
 */
export function callSwFunction(swFunction, key) {
  navigator.serviceWorker.controller.postMessage({
    key,
    fnStr: swFunction.toString(),
  });
}

/**
 * 
 * @param {String} eventType 
 * @param {String} id 
 * @param {(eventObj, swCtx: ServiceWorkerGlobalScope, sharedCtx: Object<string, *>) => *} handler 
 * @param {String} key
 */
export function registerHandler(eventType, id, handler, key) {
  navigator.serviceWorker.controller.postMessage({
    key,
    registerHandler: {
      id,
      type: eventType,
      handler: handler.toString(),
    },
  });
}

/**
 * 
 * @param {Object<string, *>} sharedCtx 
 * @param {String} key 
 */
export function publishSharedCtx(sharedCtx, key) {
  navigator.serviceWorker.controller.postMessage({
    key,
    sharedCtx,
  });
};
