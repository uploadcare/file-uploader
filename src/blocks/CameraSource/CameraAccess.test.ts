import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lifetime } from '../../abstract/di/Lifetime';
import { CameraAccess, type CameraAccessHost } from './CameraAccess';

const host = (overrides: Partial<CameraAccessHost> = {}) => {
  const controller = new AbortController();
  const fns = {
    lifetime: {
      whileAdopted: <T>(work: PromiseLike<T>) => Promise.resolve(work),
      runTask: vi.fn((task: () => unknown) => {
        void task();
      }),
      adoptionSignal: () => controller.signal,
    },
    onPermissionChange: vi.fn(),
    onSettled: vi.fn(),
    report: vi.fn(),
    ...overrides,
  };
  return { fns, devices: new CameraAccess(fns), abort: () => controller.abort() };
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('CameraAccess.settleLater', () => {
  it('settles once after 300 ms with the last state', () => {
    vi.useFakeTimers();
    const { fns, devices: access } = host();
    const { onSettled } = fns;

    access.settleLater('prompt');
    vi.advanceTimersByTime(299);
    access.settleLater('denied', 'not-found');
    vi.advanceTimersByTime(299);
    expect(onSettled).not.toHaveBeenCalled();
    expect(access.permission).toBe('idle');
    expect(access.failure).toBe('denied');

    vi.advanceTimersByTime(1);
    expect(onSettled).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledWith('denied');
    expect(access.permission).toBe('denied');
    expect(access.failure).toBe('not-found');
  });

  it('drops a settle after the adoption ended', () => {
    vi.useFakeTimers();
    const { fns, devices: access, abort } = host();
    const { onSettled } = fns;

    access.settleLater('granted');
    abort();
    vi.advanceTimersByTime(300);

    expect(onSettled).not.toHaveBeenCalled();
    expect(access.permission).toBe('idle');
  });

  it('drops a cancelled settle', () => {
    vi.useFakeTimers();
    const { fns, devices: access } = host();
    const { onSettled } = fns;

    access.settleLater('granted');
    access.cancel();
    vi.advanceTimersByTime(300);

    expect(onSettled).not.toHaveBeenCalled();
  });
});

describe('CameraAccess.watchPermissions', () => {
  const stubPermissions = (query: () => Promise<PermissionStatus>) =>
    vi.stubGlobal('navigator', { ...navigator, permissions: { query } });

  it('reports each permission change until it stops watching', async () => {
    const statuses: EventTarget[] = [];
    stubPermissions(async () => {
      const status = new EventTarget();
      statuses.push(status);
      return status as PermissionStatus;
    });
    const { fns, devices } = host();

    await devices.watchPermissions();
    for (const status of statuses) status.dispatchEvent(new Event('change'));
    expect(fns.onPermissionChange).toHaveBeenCalledTimes(2);

    devices.stopWatchingPermissions();
    for (const status of statuses) status.dispatchEvent(new Event('change'));
    expect(fns.onPermissionChange).toHaveBeenCalledTimes(2);
  });

  it('reports when the Permissions API fails', async () => {
    stubPermissions(async () => {
      throw new TypeError('camera is not a valid permission name');
    });
    const { fns, devices } = host();

    await devices.watchPermissions();
    expect(fns.report).toHaveBeenCalledWith(
      'warn',
      'Failed to use permissions API. Fallback to manual request mode.',
      expect.any(TypeError),
      'camera permissions. Failed to use permissions API',
    );
  });

  it('lets an abort through', async () => {
    stubPermissions(async () => {
      throw new DOMException('gone', 'AbortError');
    });
    const { devices } = host();

    await expect(devices.watchPermissions()).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('CameraAccess moved while the permissions are queried', () => {
  it("keeps the next adoption's watch when the released query settles", async () => {
    let adoption = new Lifetime();
    const { fns, devices } = host({
      lifetime: {
        whileAdopted: (work, dispose) => adoption.guard(work, dispose),
        runTask: (task) => adoption.run(task, () => {}),
        adoptionSignal: () => adoption.signal,
      },
    });
    const first = Promise.withResolvers<PermissionStatus>();
    const statuses: EventTarget[] = [];
    const query = vi.fn(async () => {
      const status = new EventTarget();
      statuses.push(status);
      return status as PermissionStatus;
    });
    query.mockReturnValueOnce(first.promise);
    vi.stubGlobal('navigator', { ...navigator, permissions: { query } });

    const released = devices.watchPermissions();
    // A same-task DOM move: the block is released and re-adopted, and the next adoption watches again.
    adoption.end();
    adoption = new Lifetime();
    await devices.watchPermissions();
    first.resolve(new EventTarget() as PermissionStatus);
    await expect(released).rejects.toThrow(/owner of this work is gone/);

    for (const status of statuses) status.dispatchEvent(new Event('change'));
    expect(fns.onPermissionChange).toHaveBeenCalledTimes(2);
  });
});
