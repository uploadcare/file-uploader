import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { describe, expect, it, vi } from 'vitest';
import { HostScopeController } from './HostScopeController';

// Minimal host: records the controller so the test can drive its lifecycle.
class FakeHost {
  public controllers: ReactiveController[] = [];
  public addController(c: ReactiveController): void {
    this.controllers.push(c);
  }
  public removeController(): void {}
  public requestUpdate(): void {}
  public updateComplete = Promise.resolve(true);
}

const asHost = (host: FakeHost) => host as unknown as ReactiveControllerHost;

describe('HostScopeController', () => {
  it('adds itself to the host', () => {
    const host = new FakeHost();
    const controller = new HostScopeController(asHost(host), () => () => {});
    expect(host.controllers).toContain(controller);
  });

  it('registers on hostConnected and unregisters on hostDisconnected', () => {
    const host = new FakeHost();
    const unregister = vi.fn();
    const register = vi.fn(() => unregister);
    const controller = new HostScopeController(asHost(host), register);

    controller.hostConnected();
    expect(register).toHaveBeenCalledTimes(1);
    expect(unregister).not.toHaveBeenCalled();

    controller.hostDisconnected();
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it('does not re-register while already connected (idempotent hostConnected)', () => {
    const host = new FakeHost();
    const register = vi.fn(() => () => {});
    const controller = new HostScopeController(asHost(host), register);

    controller.hostConnected();
    controller.hostConnected();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('re-registers across a disconnect → reconnect', () => {
    const host = new FakeHost();
    const register = vi.fn(() => () => {});
    const controller = new HostScopeController(asHost(host), register);

    controller.hostConnected();
    controller.hostDisconnected();
    controller.hostConnected();
    expect(register).toHaveBeenCalledTimes(2);
  });

  it('hostDisconnected without a prior register is a no-op (does not throw)', () => {
    const host = new FakeHost();
    const controller = new HostScopeController(asHost(host), () => () => {});
    expect(() => controller.hostDisconnected()).not.toThrow();
  });
});
