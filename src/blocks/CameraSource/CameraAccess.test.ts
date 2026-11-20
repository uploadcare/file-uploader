import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lifetime } from '../../abstract/di/Lifetime';
import { CameraAccess, type CameraAccessHost } from './CameraAccess';

const host = (overrides: Partial<CameraAccessHost> = {}) => {
  const lifetime = new Lifetime();
  const fns = {
    lifetime,
    onPermissionChange: vi.fn(),
    onSettled: vi.fn(),
    report: vi.fn(),
    ...overrides,
  };
  return { fns, devices: new CameraAccess(fns), abort: () => lifetime.end() };
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

  it('shows what the session before showed', () => {
    vi.useFakeTimers();
    const { devices: previous } = host();
    previous.settleLater('denied', 'not-found');
    vi.advanceTimersByTime(300);

    const { devices: access } = host();
    access.keep(previous);

    expect([access.permission, access.failure]).toEqual(['denied', 'not-found']);
  });
});

describe('CameraAccess.watchPermissions', () => {
  const stubPermissions = (query: () => Promise<PermissionStatus>) =>
    vi.stubGlobal('navigator', { ...navigator, permissions: { query } });

  it('reports each permission change until the lifetime ends', async () => {
    const statuses: EventTarget[] = [];
    stubPermissions(async () => {
      const status = new EventTarget();
      statuses.push(status);
      return status as PermissionStatus;
    });
    const { fns, devices, abort } = host();

    await devices.watchPermissions();
    for (const status of statuses) status.dispatchEvent(new Event('change'));
    expect(fns.onPermissionChange).toHaveBeenCalledTimes(2);

    abort();
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

  it('watches nothing when the second permission cannot be queried', async () => {
    const camera = new EventTarget();
    const query = vi.fn(async () => camera as PermissionStatus);
    query.mockResolvedValueOnce(camera as PermissionStatus).mockRejectedValueOnce(new TypeError('not a permission'));
    stubPermissions(query);
    const { fns, devices } = host();

    await devices.watchPermissions();
    camera.dispatchEvent(new Event('change'));

    expect(fns.report).toHaveBeenCalledOnce();
    expect(fns.onPermissionChange).not.toHaveBeenCalled();
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
    const before = host();
    const { fns, devices } = host();
    const first = Promise.withResolvers<PermissionStatus>();
    const statuses: EventTarget[] = [];
    const query = vi.fn(async () => {
      const status = new EventTarget();
      statuses.push(status);
      return status as PermissionStatus;
    });
    query.mockReturnValueOnce(first.promise);
    vi.stubGlobal('navigator', { ...navigator, permissions: { query } });

    const released = before.devices.watchPermissions();
    // A same-task DOM move: the adoption ends with its session, and the next one's watches again.
    before.abort();
    await devices.watchPermissions();
    const late = new EventTarget();
    first.resolve(late as PermissionStatus);
    await expect(released).rejects.toThrow(/owner of this work is gone/);

    for (const status of [...statuses, late]) status.dispatchEvent(new Event('change'));
    expect(fns.onPermissionChange).toHaveBeenCalledTimes(2);
    expect(before.fns.onPermissionChange).not.toHaveBeenCalled();
  });
});
