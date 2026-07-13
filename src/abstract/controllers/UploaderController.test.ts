import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import { EventBus, UploaderEventType } from '../EventBus';
import { LocaleManager } from '../managers/LocaleManager';
import { TelemetryManager } from '../managers/TelemetryManager';
import { ConfigController } from './ConfigController';
import { LocaleController } from './LocaleController';
import { RouterController } from './RouterController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploaderController } from './UploaderController';

describe('UploaderController', () => {
  it('constructs with event, config, and locale controllers', () => {
    const controller = new UploaderController();
    expect(controller.events).toBeInstanceOf(EventBus);
    expect(controller.config).toBeInstanceOf(ConfigController);
    expect(controller.locale).toBeInstanceOf(LocaleController);
  });

  it('uses injected sub-controllers instead of constructing its own', () => {
    const events = new EventBus();
    const config = new ConfigController();
    const locale = new LocaleController();
    const collection = new UploadCollectionController();

    const controller = new UploaderController({ events, config, locale, collection });

    expect(controller.events).toBe(events);
    expect(controller.config).toBe(config);
    expect(controller.locale).toBe(locale);
    expect(controller.collection).toBe(collection);
  });

  it('defaults each un-injected sub-controller to a fresh instance', () => {
    const config = new ConfigController();

    const controller = new UploaderController({ config });

    expect(controller.config).toBe(config); // injected one preserved
    expect(controller.events).toBeInstanceOf(EventBus); // the rest defaulted
    expect(controller.locale).toBeInstanceOf(LocaleController);
    expect(controller.collection).toBeInstanceOf(UploadCollectionController);
  });

  describe('solutionName', () => {
    it('stores the name lowercased (tag names arrive uppercase)', () => {
      const controller = new UploaderController();
      expect(controller.solutionName).toBeNull();

      controller.setSolutionName('UC-FILE-UPLOADER-REGULAR');

      expect(controller.solutionName).toBe('uc-file-uploader-regular');
    });

    it('lets the most recently initialized solution identify the scope', () => {
      const controller = new UploaderController();

      // Several solutions sharing one ctx-name is a supported composition
      // (e.g. uploader + standalone editor) — v1 pub last-writer parity.
      controller.setSolutionName('UC-FILE-UPLOADER-REGULAR');
      controller.setSolutionName('UC-CLOUD-IMAGE-EDITOR');

      expect(controller.solutionName).toBe('uc-cloud-image-editor');
    });
  });

  it('destroy() tears down without throwing', () => {
    const controller = new UploaderController();
    expect(() => controller.destroy()).not.toThrow();
  });

  describe('ctx-scope managers', () => {
    it('constructs its own localeManager, eventEmitter, telemetryManager, and router', () => {
      const controller = new UploaderController();
      expect(controller.localeManager).toBeInstanceOf(LocaleManager);
      expect(controller.eventEmitter).toBeInstanceOf(EventEmitter);
      expect(controller.telemetryManager).toBeInstanceOf(TelemetryManager);
      expect(controller.router).toBeInstanceOf(RouterController);
    });

    it('uses injected managers instead of constructing its own', () => {
      const localeManager = new LocaleManager({ config: new ConfigController(), locale: new LocaleController() });
      const eventEmitter = new EventEmitter(new EventBus());
      const telemetryManager = new TelemetryManager({
        config: new ConfigController(),
        getSolution: () => null,
        getActivity: () => null,
      });
      const router = new RouterController({ emit: () => {} });

      const controller = new UploaderController({ localeManager, eventEmitter, telemetryManager, router });

      expect(controller.localeManager).toBe(localeManager);
      expect(controller.eventEmitter).toBe(eventEmitter);
      expect(controller.telemetryManager).toBe(telemetryManager);
      expect(controller.router).toBe(router);
    });

    it("wires the router's emit to the controller's own emit, debouncing modal transitions", () => {
      const controller = new UploaderController();
      const emitSpy = vi.spyOn(controller, 'emit');

      controller.router.openModal('camera' as never);

      expect(emitSpy).toHaveBeenCalledWith(UploaderEventType.MODAL_OPEN, { modalId: 'camera' }, { debounce: true });
    });
  });

  describe('emit', () => {
    it('dispatches through the owned EventEmitter/EventBus to a listener', () => {
      const controller = new UploaderController();
      const handler = vi.fn();
      controller.eventEmitter.on(UploaderEventType.UPLOAD_CLICK, handler);

      controller.emit(UploaderEventType.UPLOAD_CLICK);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('mirrors the event to the owned TelemetryManager', () => {
      const controller = new UploaderController();
      const sendEventSpy = vi.spyOn(controller.telemetryManager, 'sendEvent');

      controller.emit(UploaderEventType.UPLOAD_CLICK, undefined);

      expect(sendEventSpy).toHaveBeenCalledWith({ eventType: UploaderEventType.UPLOAD_CLICK, payload: undefined });
    });

    it('resolves a function payload before mirroring to telemetry', () => {
      const controller = new UploaderController();
      const sendEventSpy = vi.spyOn(controller.telemetryManager, 'sendEvent');

      controller.emit(UploaderEventType.DONE_CLICK, () => ({ foo: 'bar' }) as never);

      expect(sendEventSpy).toHaveBeenCalledWith({
        eventType: UploaderEventType.DONE_CLICK,
        payload: { foo: 'bar' },
      });
    });

    it('contains a telemetry mirror failure — the listener still ran, and emit never throws', () => {
      const controller = new UploaderController();
      const handler = vi.fn();
      controller.eventEmitter.on(UploaderEventType.UPLOAD_CLICK, handler);
      vi.spyOn(controller.telemetryManager, 'sendEvent').mockImplementation(() => {
        throw new Error('boom');
      });

      expect(() => controller.emit(UploaderEventType.UPLOAD_CLICK)).not.toThrow();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('is a silent no-op after destroy()', () => {
      const controller = new UploaderController();
      const handler = vi.fn();
      controller.eventEmitter.on(UploaderEventType.UPLOAD_CLICK, handler);
      const sendEventSpy = vi.spyOn(controller.telemetryManager, 'sendEvent');

      controller.destroy();
      expect(() => controller.emit(UploaderEventType.UPLOAD_CLICK)).not.toThrow();

      expect(handler).not.toHaveBeenCalled();
      expect(sendEventSpy).not.toHaveBeenCalled();
    });
  });

  it('destroy() tears down the ctx-scope managers too, in reverse construction order', () => {
    const controller = new UploaderController();
    const routerDestroy = vi.spyOn(controller.router, 'destroy');
    const telemetryDestroy = vi.spyOn(controller.telemetryManager, 'destroy');
    const eventEmitterDestroy = vi.spyOn(controller.eventEmitter, 'destroy');
    const localeManagerDestroy = vi.spyOn(controller.localeManager, 'destroy');

    controller.destroy();

    expect(routerDestroy).toHaveBeenCalled();
    expect(telemetryDestroy).toHaveBeenCalled();
    expect(eventEmitterDestroy).toHaveBeenCalled();
    expect(localeManagerDestroy).toHaveBeenCalled();

    const routerOrder = routerDestroy.mock.invocationCallOrder[0]!;
    const telemetryOrder = telemetryDestroy.mock.invocationCallOrder[0]!;
    const eventEmitterOrder = eventEmitterDestroy.mock.invocationCallOrder[0]!;
    const localeManagerOrder = localeManagerDestroy.mock.invocationCallOrder[0]!;
    expect(routerOrder).toBeLessThan(telemetryOrder);
    expect(telemetryOrder).toBeLessThan(eventEmitterOrder);
    expect(eventEmitterOrder).toBeLessThan(localeManagerOrder);
  });

  it('is DOM-free — constructing touches no element APIs', () => {
    // The controller must never reach into the document. Constructing it
    // with `document` made unavailable proves it (the UI adapter layer owns
    // all DOM concerns, not the controller).
    const realDocument = globalThis.document;
    // @ts-expect-error intentionally removing document for this assertion
    delete globalThis.document;
    try {
      expect(() => new UploaderController()).not.toThrow();
    } finally {
      globalThis.document = realDocument;
    }
  });
});
