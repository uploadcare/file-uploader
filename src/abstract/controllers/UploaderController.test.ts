import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import { EventBus, UploaderEventType } from '../EventBus';
import { A11y } from '../managers/a11y';
import { LocaleManager } from '../managers/LocaleManager';
import { TelemetryManager } from '../managers/TelemetryManager';
import { ClipboardController } from './ClipboardController';
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
    it('constructs its own localeManager, eventEmitter, telemetryManager, router, a11y, and clipboard', () => {
      const controller = new UploaderController();
      expect(controller.localeManager).toBeInstanceOf(LocaleManager);
      expect(controller.eventEmitter).toBeInstanceOf(EventEmitter);
      expect(controller.telemetryManager).toBeInstanceOf(TelemetryManager);
      expect(controller.router).toBeInstanceOf(RouterController);
      expect(controller.a11y).toBeInstanceOf(A11y);
      expect(controller.clipboard).toBeInstanceOf(ClipboardController);
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
      const a11y = new A11y();
      const clipboard = new ClipboardController({
        getPasteScope: () => false,
        getCurrentActivity: () => null,
        addFileFromObject: () => {},
        addFileFromUrl: () => {},
        onFileAdd: () => {},
      });

      const controller = new UploaderController({
        localeManager,
        eventEmitter,
        telemetryManager,
        router,
        a11y,
        clipboard,
      });

      expect(controller.localeManager).toBe(localeManager);
      expect(controller.eventEmitter).toBe(eventEmitter);
      expect(controller.telemetryManager).toBe(telemetryManager);
      expect(controller.router).toBe(router);
      expect(controller.a11y).toBe(a11y);
      expect(controller.clipboard).toBe(clipboard);
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
    const clipboardDestroy = vi.spyOn(controller.clipboard, 'destroy');
    const a11yDestroy = vi.spyOn(controller.a11y, 'destroy');
    const routerDestroy = vi.spyOn(controller.router, 'destroy');
    const telemetryDestroy = vi.spyOn(controller.telemetryManager, 'destroy');
    const eventEmitterDestroy = vi.spyOn(controller.eventEmitter, 'destroy');
    const localeManagerDestroy = vi.spyOn(controller.localeManager, 'destroy');

    controller.destroy();

    expect(clipboardDestroy).toHaveBeenCalled();
    expect(a11yDestroy).toHaveBeenCalled();
    expect(routerDestroy).toHaveBeenCalled();
    expect(telemetryDestroy).toHaveBeenCalled();
    expect(eventEmitterDestroy).toHaveBeenCalled();
    expect(localeManagerDestroy).toHaveBeenCalled();

    const clipboardOrder = clipboardDestroy.mock.invocationCallOrder[0]!;
    const a11yOrder = a11yDestroy.mock.invocationCallOrder[0]!;
    const routerOrder = routerDestroy.mock.invocationCallOrder[0]!;
    const telemetryOrder = telemetryDestroy.mock.invocationCallOrder[0]!;
    const eventEmitterOrder = eventEmitterDestroy.mock.invocationCallOrder[0]!;
    const localeManagerOrder = localeManagerDestroy.mock.invocationCallOrder[0]!;
    expect(clipboardOrder).toBeLessThan(a11yOrder);
    expect(a11yOrder).toBeLessThan(routerOrder);
    expect(routerOrder).toBeLessThan(telemetryOrder);
    expect(telemetryOrder).toBeLessThan(eventEmitterOrder);
    expect(eventEmitterOrder).toBeLessThan(localeManagerOrder);
  });

  it('destroy() tolerates running with the api never set (no paste ever happened)', () => {
    const controller = new UploaderController();
    expect(() => controller.destroy()).not.toThrow();
  });

  describe('api (uploader-scope public API — element-constructed, controller-held)', () => {
    it('throws if accessed before setApi()', () => {
      const controller = new UploaderController();
      expect(() => controller.api).toThrow(/setApi/);
    });

    it('returns the instance passed to setApi()', () => {
      const controller = new UploaderController();
      const fakeApi = { addFileFromObject: vi.fn(), addFileFromUrl: vi.fn() } as never;

      controller.setApi(fakeApi);

      expect(controller.api).toBe(fakeApi);
    });

    it("wires the clipboard controller's add-file callbacks to setApi()'s instance, resolved lazily", async () => {
      const controller = new UploaderController();
      const addFileFromObject = vi.fn();
      const addFileFromUrl = vi.fn();

      // setApi() runs AFTER the clipboard controller is already constructed —
      // proving the callbacks resolve `api` lazily rather than capturing it
      // at construction time.
      controller.setApi({ addFileFromObject, addFileFromUrl } as never);

      const file = new File(['x'], 'x.txt');
      const scope = document.createElement('div');
      document.body.appendChild(scope);
      controller.clipboard.registerScope(scope);
      try {
        const clipboardData = {
          items: [{ kind: 'file', getAsFile: () => file }],
        } as unknown as DataTransfer;
        const event = new ClipboardEvent('paste', { clipboardData: undefined });
        Object.defineProperty(event, 'clipboardData', { value: clipboardData });
        Object.defineProperty(event, 'target', { value: scope });
        window.dispatchEvent(event);
        await Promise.resolve();
        await Promise.resolve();

        expect(addFileFromObject).toHaveBeenCalledWith(file, { source: 'clipboard' });
      } finally {
        scope.remove();
        controller.destroy();
      }
    });
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
