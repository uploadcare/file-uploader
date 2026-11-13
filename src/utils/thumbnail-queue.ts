// Drawing a local thumbnail decodes the full-size image, on the main thread where the browser cannot do it elsewhere
// (`generateThumb`), so a list of photos opening all at once stalls the page: there, ten at once measured a worst
// frame gap of 112 ms, one at a time 27 ms, for about the same total.
const LIMIT = 4;

let running = 0;
const pending: (() => void)[] = [];

/**
 * Run `work` once one of the few slots is free. Waiting jobs start newest first, so the rows just scrolled to are
 * served before the ones already passed. A job still waiting when `signal` aborts is dropped without running and
 * rejects with the signal's reason; a running one finishes.
 */
export const queueThumbnail = <T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const drop = (): void => {
      pending.splice(pending.indexOf(start), 1);
      reject(signal?.reason);
    };
    const start = (): void => {
      signal?.removeEventListener('abort', drop);
      running++;
      new Promise<T>((started) => started(work()))
        .finally(() => {
          running--;
          pending.pop()?.();
        })
        .then(resolve, reject);
    };
    if (signal?.aborted) {
      reject(signal.reason);
    } else if (running < LIMIT) {
      start();
    } else {
      pending.push(start);
      signal?.addEventListener('abort', drop);
    }
  });
