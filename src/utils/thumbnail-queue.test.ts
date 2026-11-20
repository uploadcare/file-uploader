import { describe, expect, it } from 'vitest';
import { delay } from './delay';
import { queueThumbnail } from './thumbnail-queue';

/** A job that records when it starts and settles when the test says so. */
const makeJobs = () => {
  const started: number[] = [];
  const settle = new Map<number, { resolve: (value: number) => void; reject: (error: Error) => void }>();
  const job = (id: number) => (): Promise<number> => {
    started.push(id);
    return new Promise<number>((resolve, reject) => settle.set(id, { resolve, reject }));
  };
  /** Finish every started job, then the ones that start in turn, so the shared queue is empty for the next test. */
  const drain = async (): Promise<void> => {
    while (settle.size) {
      for (const [id, { resolve }] of [...settle]) {
        settle.delete(id);
        resolve(id);
      }
      await delay(0);
    }
  };
  return { started, settle, job, drain };
};

describe('queueThumbnail', () => {
  it('runs four jobs at a time', async () => {
    const { started, settle, job, drain } = makeJobs();
    const results = [1, 2, 3, 4, 5, 6].map((id) => queueThumbnail(job(id)));
    expect(started).toEqual([1, 2, 3, 4]);

    settle.get(1)?.resolve(1);
    await delay(0);
    expect(started).toHaveLength(5);

    await drain();
    await expect(Promise.all(results)).resolves.toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('starts the most recently requested pending job first', async () => {
    const { started, settle, job, drain } = makeJobs();
    const results = [1, 2, 3, 4, 5, 6, 7].map((id) => queueThumbnail(job(id)));

    settle.get(1)?.resolve(1);
    await delay(0);
    settle.get(2)?.resolve(2);
    await delay(0);
    expect(started).toEqual([1, 2, 3, 4, 7, 6]);

    await drain();
    await Promise.all(results);
  });

  it('drops a pending job whose signal aborts, without running it', async () => {
    const { started, job, drain } = makeJobs();
    const running = [1, 2, 3, 4].map((id) => queueThumbnail(job(id)));
    const controller = new AbortController();
    const dropped = queueThumbnail(job(5), controller.signal);
    const kept = queueThumbnail(job(6));

    const reason = new DOMException('gone', 'AbortError');
    controller.abort(reason);
    await expect(dropped).rejects.toBe(reason);

    await drain();
    await Promise.all([...running, kept]);
    expect(started).toEqual([1, 2, 3, 4, 6]);
  });

  it('does not run a job whose signal has already aborted', async () => {
    const { started, job } = makeJobs();
    const reason = new DOMException('gone', 'AbortError');
    await expect(queueThumbnail(job(1), AbortSignal.abort(reason))).rejects.toBe(reason);
    expect(started).toEqual([]);
  });

  it('lets a running job finish after its signal aborts', async () => {
    const { settle, job } = makeJobs();
    const controller = new AbortController();
    const result = queueThumbnail(job(1), controller.signal);
    controller.abort();
    settle.get(1)?.resolve(1);
    await expect(result).resolves.toBe(1);
  });

  it('frees the slot of a job that fails, rejecting or throwing', async () => {
    const { started, settle, job, drain } = makeJobs();
    const failing = queueThumbnail(job(1));
    const throwing = queueThumbnail(() => {
      throw new Error('thrown');
    });
    const running = [3, 4].map((id) => queueThumbnail(job(id)));
    const next = [5, 6].map((id) => queueThumbnail(job(id)));
    expect(started).toEqual([1, 3, 4]);

    await expect(throwing).rejects.toThrow('thrown');
    await delay(0);
    expect(started).toEqual([1, 3, 4, 6]);

    settle.get(1)?.reject(new Error('rejected'));
    await expect(failing).rejects.toThrow('rejected');
    await delay(0);
    expect(started).toEqual([1, 3, 4, 6, 5]);

    await drain();
    await Promise.all([...running, ...next]);
  });
});
