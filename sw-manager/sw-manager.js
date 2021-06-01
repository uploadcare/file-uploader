/**
 * 
 * @param {String} swPath 
 * @param {String} scope 
 * @returns {Promise<ServiceWorker>}
 */
export function registerSw(swPath, scope) {
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
      resolve(swr.active);
    } else {
      swr.active.onstatechange = () => {
        if (swr.active.state === swState) {
          resolve(swr.active);
        }
      }
    }
  });
}

/**
 * 
 * @param {ServiceWorker} sw
 * @param {'fetch' | 'message' | 'activate'} eventType 
 * @param {Function} handler 
 */
export function registerHandler(sw, eventType, handler) {

}