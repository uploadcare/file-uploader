import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import type { Uid } from '../../lit/Uid';
import { EventBus, UploaderEventType } from '../EventBus';
import { A11y } from '../managers/a11y';
import { LocaleManager } from '../managers/LocaleManager';
import { TelemetryManager } from '../managers/TelemetryManager';
import { ClipboardController } from './ClipboardController';
import { ConfigController } from './ConfigController';
import { LocaleController } from './LocaleController';
import { RouterController } from './RouterController';
import { SecureUploadsController } from './SecureUploadsController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadController } from './UploadController';
import { UploadEventsController } from './UploadEventsController';
import { UploaderController, type UploaderScopeDeps, type UploaderStateBridges } from './UploaderController';
import { ValidationController } from './ValidationController';

const makeUploaderScopeDeps = (overrides: Partial<UploaderScopeDeps> = {}): UploaderScopeDeps => ({
  controllers: { SecureUploadsController, UploadController, ValidationController, UploadEventsController },
  getFileHooks: () => [],
  getOutputItem: (() => ({}) as never) as never,
  getApi: () => ({}) as never,
  emitCommonUploadFailed: () => {},
  emit: () => {},
  getOutputCollectionState: () => ({}) as never,
  getOutputData: () => [],
  runOnAddHooks: () => {},
  ...overrides,
});

const makeStateBridges = (overrides: Partial<UploaderStateBridges> = {}): UploaderStateBridges => ({
  setCollectionErrors: vi.fn(),
  uploadTrigger: vi.fn(() => new Set<Uid>()),
  setUploadList: vi.fn(),
  getCollectionState: vi.fn(() => null),
  setCollectionState: vi.fn(),
  getCommonProgress: vi.fn(() => 0),
  setCommonProgress: vi.fn(),
  setGroupInfo: vi.fn(),
  getCollectionErrors: vi.fn(() => []),
  ...overrides,
});

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

  describe('attachUploaderScope (the upload stack, behind the uploader-present gate)', () => {
    it('throws accessing any of the four getters before attach — matching the `api` getter convention', () => {
      const controller = new UploaderController();
      expect(() => controller.secureUploadsManager).toThrow(/attachUploaderScope/);
      expect(() => controller.uploadController).toThrow(/attachUploaderScope/);
      expect(() => controller.validationManager).toThrow(/attachUploaderScope/);
      expect(() => controller.uploadEvents).toThrow(/attachUploaderScope/);
    });

    it('constructs the four sub-controllers, wired to the same config/collection', () => {
      const controller = new UploaderController();

      controller.attachUploaderScope(makeUploaderScopeDeps());

      expect(controller.secureUploadsManager).toBeInstanceOf(SecureUploadsController);
      expect(controller.uploadController).toBeInstanceOf(UploadController);
      expect(controller.validationManager).toBeInstanceOf(ValidationController);
      expect(controller.uploadEvents).toBeInstanceOf(UploadEventsController);

      controller.destroy();
    });

    it('starts the upload-events collection observation (v1 parity: observe() at the end of construction)', () => {
      const controller = new UploaderController();
      const observeSpy = vi.spyOn(UploadEventsController.prototype, 'observe');

      controller.attachUploaderScope(makeUploaderScopeDeps());

      expect(observeSpy).toHaveBeenCalledTimes(1);

      controller.destroy();
      observeSpy.mockRestore();
    });

    it('is idempotent — a second call does not reconstruct any of the four', () => {
      const controller = new UploaderController();
      controller.attachUploaderScope(makeUploaderScopeDeps());
      const secureUploadsManager = controller.secureUploadsManager;
      const uploadController = controller.uploadController;
      const validationManager = controller.validationManager;
      const uploadEvents = controller.uploadEvents;

      controller.attachUploaderScope(makeUploaderScopeDeps());

      expect(controller.secureUploadsManager).toBe(secureUploadsManager);
      expect(controller.uploadController).toBe(uploadController);
      expect(controller.validationManager).toBe(validationManager);
      expect(controller.uploadEvents).toBe(uploadEvents);

      controller.destroy();
    });

    it('is inert after destroy() — a late attach never constructs the stack', () => {
      const controller = new UploaderController();
      controller.destroy();

      controller.attachUploaderScope(makeUploaderScopeDeps());

      expect(() => controller.secureUploadsManager).toThrow(/attachUploaderScope/);
      expect(() => controller.uploadController).toThrow(/attachUploaderScope/);
      expect(() => controller.validationManager).toThrow(/attachUploaderScope/);
      expect(() => controller.uploadEvents).toThrow(/attachUploaderScope/);
    });

    it("routes onResolverError to the controller's own telemetryManager", async () => {
      const controller = new UploaderController();
      const sendEventError = vi.spyOn(controller.telemetryManager, 'sendEventError');
      controller.attachUploaderScope(makeUploaderScopeDeps());
      controller.config.set('secureUploadsSignatureResolver', (() => {
        throw new Error('boom');
      }) as never);

      await controller.secureUploadsManager.getSecureToken();

      expect(sendEventError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('secureUploadsSignatureResolver'),
      );

      controller.destroy();
    });

    it('destroy() tears down the four in reverse construction order, before the collection', () => {
      const controller = new UploaderController();
      controller.attachUploaderScope(makeUploaderScopeDeps());

      const uploadEventsDestroy = vi.spyOn(controller.uploadEvents, 'destroy');
      const validationDestroy = vi.spyOn(controller.validationManager, 'destroy');
      const uploadControllerDestroy = vi.spyOn(controller.uploadController, 'destroy');
      const secureUploadsDestroy = vi.spyOn(controller.secureUploadsManager, 'destroy');
      const collectionDestroy = vi.spyOn(controller.collection, 'destroy');

      controller.destroy();

      expect(uploadEventsDestroy).toHaveBeenCalled();
      expect(validationDestroy).toHaveBeenCalled();
      expect(uploadControllerDestroy).toHaveBeenCalled();
      expect(secureUploadsDestroy).toHaveBeenCalled();
      expect(collectionDestroy).toHaveBeenCalled();

      const uploadEventsOrder = uploadEventsDestroy.mock.invocationCallOrder[0]!;
      const validationOrder = validationDestroy.mock.invocationCallOrder[0]!;
      const uploadControllerOrder = uploadControllerDestroy.mock.invocationCallOrder[0]!;
      const secureUploadsOrder = secureUploadsDestroy.mock.invocationCallOrder[0]!;
      const collectionOrder = collectionDestroy.mock.invocationCallOrder[0]!;

      expect(uploadEventsOrder).toBeLessThan(validationOrder);
      expect(validationOrder).toBeLessThan(uploadControllerOrder);
      expect(uploadControllerOrder).toBeLessThan(secureUploadsOrder);
      // uploadEvents.unobserve() must detach from a still-live collection.
      expect(secureUploadsOrder).toBeLessThan(collectionOrder);
    });

    it('destroy() tolerates never having attached the uploader scope', () => {
      const controller = new UploaderController();
      expect(() => controller.destroy()).not.toThrow();
    });

    it('destroy() nulls the held api — accessing it afterwards throws (M9l follow-up)', () => {
      const controller = new UploaderController();
      controller.setApi({ addFileFromObject: vi.fn(), addFileFromUrl: vi.fn() } as never);

      controller.destroy();

      expect(() => controller.api).toThrow(/setApi/);
    });

    describe('stateBridges (constructor-time, M9n Task 3 — no longer part of UploaderScopeDeps)', () => {
      it("wires validation's setCollectionErrors from the constructor-injected stateBridges, not attach-time deps", () => {
        const stateBridges = makeStateBridges();
        const controller = new UploaderController({ stateBridges });
        let capturedDeps: { setCollectionErrors: UploaderStateBridges['setCollectionErrors'] } | undefined;
        const ValidationControllerSpy = vi.fn(function (
          this: unknown,
          deps: { setCollectionErrors: UploaderStateBridges['setCollectionErrors'] },
        ) {
          capturedDeps = deps;
          return new ValidationController(deps as never);
        }) as unknown as typeof ValidationController;

        controller.attachUploaderScope({
          ...makeUploaderScopeDeps(),
          controllers: {
            SecureUploadsController,
            UploadController,
            ValidationController: ValidationControllerSpy,
            UploadEventsController,
          },
        });

        expect(capturedDeps?.setCollectionErrors).toBe(stateBridges.setCollectionErrors);

        controller.destroy();
      });

      it('wires all 8 uploadEvents state bridges from the constructor-injected stateBridges, not attach-time deps', () => {
        const stateBridges = makeStateBridges();
        const controller = new UploaderController({ stateBridges });
        let capturedDeps:
          | Pick<
              UploaderStateBridges,
              | 'uploadTrigger'
              | 'setUploadList'
              | 'getCollectionState'
              | 'setCollectionState'
              | 'getCommonProgress'
              | 'setCommonProgress'
              | 'setGroupInfo'
              | 'getCollectionErrors'
            >
          | undefined;
        const UploadEventsControllerSpy = vi.fn(function (
          this: unknown,
          deps: Pick<
            UploaderStateBridges,
            | 'uploadTrigger'
            | 'setUploadList'
            | 'getCollectionState'
            | 'setCollectionState'
            | 'getCommonProgress'
            | 'setCommonProgress'
            | 'setGroupInfo'
            | 'getCollectionErrors'
          >,
        ) {
          capturedDeps = deps;
          return new UploadEventsController(deps as never);
        }) as unknown as typeof UploadEventsController;

        controller.attachUploaderScope({
          ...makeUploaderScopeDeps(),
          controllers: {
            SecureUploadsController,
            UploadController,
            ValidationController,
            UploadEventsController: UploadEventsControllerSpy,
          },
        });

        expect(capturedDeps?.uploadTrigger).toBe(stateBridges.uploadTrigger);
        expect(capturedDeps?.setUploadList).toBe(stateBridges.setUploadList);
        expect(capturedDeps?.getCollectionState).toBe(stateBridges.getCollectionState);
        expect(capturedDeps?.setCollectionState).toBe(stateBridges.setCollectionState);
        expect(capturedDeps?.getCommonProgress).toBe(stateBridges.getCommonProgress);
        expect(capturedDeps?.setCommonProgress).toBe(stateBridges.setCommonProgress);
        expect(capturedDeps?.setGroupInfo).toBe(stateBridges.setGroupInfo);
        expect(capturedDeps?.getCollectionErrors).toBe(stateBridges.getCollectionErrors);

        controller.destroy();
      });

      it('defaults stateBridges to inert no-ops when not injected — attach never throws', () => {
        const controller = new UploaderController();

        expect(() => controller.attachUploaderScope(makeUploaderScopeDeps())).not.toThrow();

        controller.destroy();
      });
    });
  });
});
