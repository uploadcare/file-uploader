import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import type { Uid } from '../../lit/Uid';
import { ControllerContainer } from '../di/ControllerContainer';
import { EventBus, UploaderEventType } from '../EventBus';
import { A11y } from '../managers/a11y';
import { LocaleManager } from '../managers/LocaleManager';
import { TelemetryManager } from '../managers/TelemetryManager';
import { AppInfo } from './AppInfo';
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

// The controller now receives its per-ctx DI container at construction (the
// container owns `config`/`locale`). Tests that don't care about the container
// build one throwaway per controller.
const makeController = (deps?: ConstructorParameters<typeof UploaderController>[1]): UploaderController =>
  new UploaderController(new ControllerContainer(), deps);

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
    const controller = makeController();
    expect(controller.events).toBeInstanceOf(EventBus);
    // config/locale are resolved through the container (auto-created here).
    expect(controller.config).toBeInstanceOf(ConfigController);
    expect(controller.locale).toBeInstanceOf(LocaleController);
  });

  it('resolves config/locale/events from the container and takes an injected collection', () => {
    const container = new ControllerContainer();
    const events = new EventBus();
    const config = new ConfigController();
    const locale = new LocaleController();
    const collection = new UploadCollectionController();
    // The container owns config/locale/events — bind them here to pin the
    // instances the delegating getters must resolve.
    container.bind(ConfigController, () => config);
    container.bind(LocaleController, () => locale);
    container.bind(EventBus, () => events);

    const controller = new UploaderController(container, { collection });

    expect(controller.events).toBe(events);
    expect(controller.config).toBe(config);
    expect(controller.locale).toBe(locale);
    expect(controller.collection).toBe(collection);
  });

  it('returns the same config/locale instance on every access (container-cached)', () => {
    const controller = makeController();
    expect(controller.config).toBe(controller.config);
    expect(controller.locale).toBe(controller.locale);
    // The rest still default to fresh instances.
    expect(controller.events).toBeInstanceOf(EventBus);
    expect(controller.collection).toBeInstanceOf(UploadCollectionController);
  });

  describe('solutionName', () => {
    it('stores the name lowercased (tag names arrive uppercase)', () => {
      const controller = makeController();
      expect(controller.solutionName).toBeNull();

      controller.setSolutionName('UC-FILE-UPLOADER-REGULAR');

      expect(controller.solutionName).toBe('uc-file-uploader-regular');
    });

    it('lets the most recently initialized solution identify the scope', () => {
      const controller = makeController();

      // Several solutions sharing one ctx-name is a supported composition
      // (e.g. uploader + standalone editor) — v1 pub last-writer parity.
      controller.setSolutionName('UC-FILE-UPLOADER-REGULAR');
      controller.setSolutionName('UC-CLOUD-IMAGE-EDITOR');

      expect(controller.solutionName).toBe('uc-cloud-image-editor');
    });
  });

  it('destroy() tears down without throwing', () => {
    const controller = makeController();
    expect(() => controller.destroy()).not.toThrow();
  });

  it('does NOT destroy config/locale itself — the container owns their disposal', () => {
    const container = new ControllerContainer();
    container.bind(UploaderController, (c) => new UploaderController(c));
    const controller = container.get(UploaderController);
    const configDestroy = vi.spyOn(controller.config, 'destroy');
    const localeDestroy = vi.spyOn(controller.locale, 'destroy');

    controller.destroy();
    // The controller must leave config/locale alive...
    expect(configDestroy).not.toHaveBeenCalled();
    expect(localeDestroy).not.toHaveBeenCalled();

    // ...the container disposes them (reverse construction order).
    container.dispose();
    expect(configDestroy).toHaveBeenCalledTimes(1);
    expect(localeDestroy).toHaveBeenCalledTimes(1);
  });

  describe('ctx-scope managers', () => {
    it('exposes localeManager, eventEmitter, telemetryManager, router, a11y, and clipboard', () => {
      const controller = makeController();
      // localeManager/eventEmitter/a11y/router/telemetryManager resolve from the
      // container (M-god step 3b + 3c); clipboard is constructor-owned.
      expect(controller.localeManager).toBeInstanceOf(LocaleManager);
      expect(controller.eventEmitter).toBeInstanceOf(EventEmitter);
      expect(controller.telemetryManager).toBeInstanceOf(TelemetryManager);
      expect(controller.router).toBeInstanceOf(RouterController);
      expect(controller.a11y).toBeInstanceOf(A11y);
      expect(controller.clipboard).toBeInstanceOf(ClipboardController);
    });

    it('uses the constructor-injected clipboard instead of constructing its own', () => {
      const clipboard = new ClipboardController({
        getPasteScope: () => false,
        getCurrentActivity: () => null,
        addFileFromObject: () => {},
        addFileFromUrl: () => {},
        onFileAdd: () => {},
      });

      const controller = makeController({ clipboard });

      expect(controller.clipboard).toBe(clipboard);
    });

    it('resolves eventEmitter/localeManager/a11y/router/telemetryManager from the container (bound instances)', () => {
      const container = new ControllerContainer();
      const eventEmitter = new EventEmitter();
      const localeManager = new LocaleManager();
      const a11y = new A11y();
      const router = new RouterController();
      const telemetryManager = new TelemetryManager();
      container.bind(EventEmitter, () => eventEmitter);
      container.bind(LocaleManager, () => localeManager);
      container.bind(A11y, () => a11y);
      container.bind(RouterController, () => router);
      container.bind(TelemetryManager, () => telemetryManager);

      const controller = new UploaderController(container);

      expect(controller.eventEmitter).toBe(eventEmitter);
      expect(controller.localeManager).toBe(localeManager);
      expect(controller.a11y).toBe(a11y);
      expect(controller.router).toBe(router);
      expect(controller.telemetryManager).toBe(telemetryManager);
    });

    it('wires the router to emit through the container EventEmitter, debouncing modal transitions (M-god step 3c)', () => {
      // The debounce moved into RouterController; it emits directly to the
      // container-owned EventEmitter (no longer via UploaderController.emit).
      const container = new ControllerContainer();
      const emit = vi.fn();
      container.bind(EventEmitter, () => ({ emit }) as unknown as EventEmitter);
      const controller = new UploaderController(container);

      controller.router.openModal('camera' as never);

      expect(emit).toHaveBeenCalledWith(UploaderEventType.MODAL_OPEN, { modalId: 'camera' }, { debounce: true });
    });
  });

  describe('emit', () => {
    it('dispatches through the owned EventEmitter/EventBus to a listener', () => {
      const controller = makeController();
      const handler = vi.fn();
      controller.eventEmitter.on(UploaderEventType.UPLOAD_CLICK, handler);

      controller.emit(UploaderEventType.UPLOAD_CLICK);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('resolves a function payload for its listeners', () => {
      const controller = makeController();
      const handler = vi.fn();
      controller.eventEmitter.on(UploaderEventType.DONE_CLICK, handler);

      controller.emit(UploaderEventType.DONE_CLICK, () => ({ foo: 'bar' }) as never);

      expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('is pure dispatch — no telemetry mirror from emit (telemetry observes the bus, M-god step 3c)', () => {
      // UploaderController.emit no longer calls telemetry.sendEvent itself. A
      // broken telemetry observer therefore cannot break emit: the bus isolates
      // a throwing listener (isolate-and-warn), so emit never throws and the
      // real listener still runs.
      const controller = makeController();
      const handler = vi.fn();
      controller.eventEmitter.on(UploaderEventType.UPLOAD_CLICK, handler);
      vi.spyOn(controller.telemetryManager, 'sendEvent').mockImplementation(() => {
        throw new Error('boom');
      });

      expect(() => controller.emit(UploaderEventType.UPLOAD_CLICK)).not.toThrow();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('is a silent no-op after destroy() — no dispatch, so the bus observer never fires', () => {
      const controller = makeController();
      const handler = vi.fn();
      controller.eventEmitter.on(UploaderEventType.UPLOAD_CLICK, handler);
      const sendEventSpy = vi.spyOn(controller.telemetryManager, 'sendEvent');

      controller.destroy();
      expect(() => controller.emit(UploaderEventType.UPLOAD_CLICK)).not.toThrow();

      expect(handler).not.toHaveBeenCalled();
      // The `_destroyed` guard skips `eventEmitter.emit`, so nothing reaches the
      // bus and the telemetry observer is never invoked.
      expect(sendEventSpy).not.toHaveBeenCalled();
    });
  });

  it('destroy() tears down the controller-owned clipboard, leaving router/telemetry for the container (M-god step 3c)', () => {
    const container = new ControllerContainer();
    container.bind(UploaderController, (c) => new UploaderController(c));
    const controller = container.get(UploaderController);
    const clipboardDestroy = vi.spyOn(controller.clipboard, 'destroy');
    const routerDestroy = vi.spyOn(controller.router, 'destroy');
    const telemetryDestroy = vi.spyOn(controller.telemetryManager, 'destroy');

    controller.destroy();

    // clipboard is still controller-owned...
    expect(clipboardDestroy).toHaveBeenCalledTimes(1);
    // ...router/telemetry are container-owned now — not torn down by the controller.
    expect(routerDestroy).not.toHaveBeenCalled();
    expect(telemetryDestroy).not.toHaveBeenCalled();

    // The container disposes them (reverse construction order).
    container.dispose();
    expect(routerDestroy).toHaveBeenCalledTimes(1);
    expect(telemetryDestroy).toHaveBeenCalledTimes(1);
  });

  it('leaves events/eventEmitter/localeManager/a11y for the container to dispose (not destroyed by controller.destroy())', () => {
    const container = new ControllerContainer();
    container.bind(UploaderController, (c) => new UploaderController(c));
    const controller = container.get(UploaderController);
    // Touch each so the container has actually constructed + registered them.
    const eventsDestroy = vi.spyOn(controller.events, 'destroy');
    const eventEmitterDestroy = vi.spyOn(controller.eventEmitter, 'destroy');
    const localeManagerDestroy = vi.spyOn(controller.localeManager, 'destroy');
    const a11yDestroy = vi.spyOn(controller.a11y, 'destroy');

    controller.destroy();
    // The controller must leave the container-owned managers alone...
    expect(eventsDestroy).not.toHaveBeenCalled();
    expect(eventEmitterDestroy).not.toHaveBeenCalled();
    expect(localeManagerDestroy).not.toHaveBeenCalled();
    expect(a11yDestroy).not.toHaveBeenCalled();

    // ...the container disposes them.
    container.dispose();
    expect(eventsDestroy).toHaveBeenCalledTimes(1);
    expect(eventEmitterDestroy).toHaveBeenCalledTimes(1);
    expect(localeManagerDestroy).toHaveBeenCalledTimes(1);
    expect(a11yDestroy).toHaveBeenCalledTimes(1);
  });

  it('delegates solutionName/setSolutionName to the container-owned AppInfo', () => {
    const container = new ControllerContainer();
    container.bind(UploaderController, (c) => new UploaderController(c));
    const controller = container.get(UploaderController);

    expect(controller.solutionName).toBeNull();
    controller.setSolutionName('UC-FILE-UPLOADER-REGULAR');

    // The write lands on the shared AppInfo instance and reads back normalized.
    expect(controller.solutionName).toBe('uc-file-uploader-regular');
    expect(container.get(AppInfo).solutionName).toBe('uc-file-uploader-regular');
  });

  it('destroy() tolerates running with the api never set (no paste ever happened)', () => {
    const controller = makeController();
    expect(() => controller.destroy()).not.toThrow();
  });

  describe('api (uploader-scope public API — element-constructed, controller-held)', () => {
    it('throws if accessed before setApi()', () => {
      const controller = makeController();
      expect(() => controller.api).toThrow(/setApi/);
    });

    it('returns the instance passed to setApi()', () => {
      const controller = makeController();
      const fakeApi = { addFileFromObject: vi.fn(), addFileFromUrl: vi.fn() } as never;

      controller.setApi(fakeApi);

      expect(controller.api).toBe(fakeApi);
    });

    it("wires the clipboard controller's add-file callbacks to setApi()'s instance, resolved lazily", async () => {
      const controller = makeController();
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
      expect(() => makeController()).not.toThrow();
    } finally {
      globalThis.document = realDocument;
    }
  });

  describe('attachUploaderScope (the upload stack, behind the uploader-present gate)', () => {
    it('throws accessing any of the four getters before attach — matching the `api` getter convention', () => {
      const controller = makeController();
      expect(() => controller.secureUploadsManager).toThrow(/attachUploaderScope/);
      expect(() => controller.uploadController).toThrow(/attachUploaderScope/);
      expect(() => controller.validationManager).toThrow(/attachUploaderScope/);
      expect(() => controller.uploadEvents).toThrow(/attachUploaderScope/);
    });

    it('constructs the four sub-controllers, wired to the same config/collection', () => {
      const controller = makeController();

      controller.attachUploaderScope(makeUploaderScopeDeps());

      expect(controller.secureUploadsManager).toBeInstanceOf(SecureUploadsController);
      expect(controller.uploadController).toBeInstanceOf(UploadController);
      expect(controller.validationManager).toBeInstanceOf(ValidationController);
      expect(controller.uploadEvents).toBeInstanceOf(UploadEventsController);

      controller.destroy();
    });

    it('starts the upload-events collection observation (v1 parity: observe() at the end of construction)', () => {
      const controller = makeController();
      const observeSpy = vi.spyOn(UploadEventsController.prototype, 'observe');

      controller.attachUploaderScope(makeUploaderScopeDeps());

      expect(observeSpy).toHaveBeenCalledTimes(1);

      controller.destroy();
      observeSpy.mockRestore();
    });

    it('is idempotent — a second call does not reconstruct any of the four', () => {
      const controller = makeController();
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
      const controller = makeController();
      controller.destroy();

      controller.attachUploaderScope(makeUploaderScopeDeps());

      expect(() => controller.secureUploadsManager).toThrow(/attachUploaderScope/);
      expect(() => controller.uploadController).toThrow(/attachUploaderScope/);
      expect(() => controller.validationManager).toThrow(/attachUploaderScope/);
      expect(() => controller.uploadEvents).toThrow(/attachUploaderScope/);
    });

    it("routes onResolverError to the controller's own telemetryManager", async () => {
      const controller = makeController();
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
      const controller = makeController();
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
      const controller = makeController();
      expect(() => controller.destroy()).not.toThrow();
    });

    it('destroy() nulls the held api — accessing it afterwards throws (M9l follow-up)', () => {
      const controller = makeController();
      controller.setApi({ addFileFromObject: vi.fn(), addFileFromUrl: vi.fn() } as never);

      controller.destroy();

      expect(() => controller.api).toThrow(/setApi/);
    });

    describe('stateBridges (constructor-time, M9n Task 3 — no longer part of UploaderScopeDeps)', () => {
      it("wires validation's setCollectionErrors from the constructor-injected stateBridges, not attach-time deps", () => {
        const stateBridges = makeStateBridges();
        const controller = makeController({ stateBridges });
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
        const controller = makeController({ stateBridges });
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
        const controller = makeController();

        expect(() => controller.attachUploaderScope(makeUploaderScopeDeps())).not.toThrow();

        controller.destroy();
      });
    });
  });
});
