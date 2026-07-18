import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
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
import { UploadCollectionController } from './UploadCollectionController';
import { UploaderController } from './UploaderController';

// The controller now receives only its per-ctx DI container at construction
// (the container owns config/locale/clipboard/…). Tests that don't care about
// the container build one throwaway per controller.
const makeController = (): UploaderController => new UploaderController(new ControllerContainer());

describe('UploaderController', () => {
  it('constructs with event, config, and locale controllers', () => {
    const controller = makeController();
    expect(controller.events).toBeInstanceOf(EventBus);
    // config/locale are resolved through the container (auto-created here).
    expect(controller.config).toBeInstanceOf(ConfigController);
    expect(controller.locale).toBeInstanceOf(LocaleController);
  });

  it('resolves config/locale/events/collection from the container (pinned instances)', () => {
    const container = new ControllerContainer();
    const events = new EventBus();
    const config = new ConfigController();
    const locale = new LocaleController();
    const collection = new UploadCollectionController();
    // The container owns config/locale/events/collection — bind them here to pin
    // the instances the delegating getters must resolve.
    container.bind(ConfigController, () => config);
    container.bind(LocaleController, () => locale);
    container.bind(EventBus, () => events);
    container.bind(UploadCollectionController, () => collection);

    const controller = new UploaderController(container);

    expect(controller.events).toBe(events);
    expect(controller.config).toBe(config);
    expect(controller.locale).toBe(locale);
    expect(controller.collection).toBe(collection);
  });

  it('returns the same config/locale/collection instance on every access (container-cached)', () => {
    const controller = makeController();
    expect(controller.config).toBe(controller.config);
    expect(controller.locale).toBe(controller.locale);
    // Collection is container-owned now (M-god step 4) — stable identity.
    expect(controller.collection).toBeInstanceOf(UploadCollectionController);
    expect(controller.collection).toBe(controller.collection);
    expect(controller.events).toBeInstanceOf(EventBus);
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
      // localeManager/eventEmitter/a11y/router/telemetryManager/clipboard all
      // resolve from the container (M-god step 3b + 3c; clipboard 8b).
      expect(controller.localeManager).toBeInstanceOf(LocaleManager);
      expect(controller.eventEmitter).toBeInstanceOf(EventEmitter);
      expect(controller.telemetryManager).toBeInstanceOf(TelemetryManager);
      expect(controller.router).toBeInstanceOf(RouterController);
      expect(controller.a11y).toBeInstanceOf(A11y);
      expect(controller.clipboard).toBeInstanceOf(ClipboardController);
    });

    it('resolves clipboard from the container (stable identity, M-god step 8b)', () => {
      const container = new ControllerContainer();
      container.bind(UploaderController, (c) => new UploaderController(c));
      const controller = container.get(UploaderController);

      // The delegating getter resolves the container-owned instance, cached, so
      // identity is stable across accesses and equals `container.get(...)`.
      expect(controller.clipboard).toBeInstanceOf(ClipboardController);
      expect(controller.clipboard).toBe(controller.clipboard);
      expect(controller.clipboard).toBe(container.get(ClipboardController));
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

  it('leaves clipboard/router/telemetry for the container to dispose — not torn down by controller.destroy() (M-god step 8b)', () => {
    const container = new ControllerContainer();
    container.bind(UploaderController, (c) => new UploaderController(c));
    const controller = container.get(UploaderController);
    // Touch clipboard so the container has actually constructed + registered it.
    const clipboardDestroy = vi.spyOn(controller.clipboard, 'destroy');
    const routerDestroy = vi.spyOn(controller.router, 'destroy');
    const telemetryDestroy = vi.spyOn(controller.telemetryManager, 'destroy');

    controller.destroy();

    // clipboard/router/telemetry are all container-owned now (clipboard moved in
    // 8b) — the controller no longer tears any of them down itself.
    expect(clipboardDestroy).not.toHaveBeenCalled();
    expect(routerDestroy).not.toHaveBeenCalled();
    expect(telemetryDestroy).not.toHaveBeenCalled();

    // The container disposes them (reverse construction order).
    container.dispose();
    expect(clipboardDestroy).toHaveBeenCalledTimes(1);
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

  describe('destroy (upload stack now container-owned via registerUploadStack — M-god step 5)', () => {
    it('exposes its container so the element layer can register the upload stack', () => {
      const container = new ControllerContainer();
      container.bind(UploaderController, (c) => new UploaderController(c));
      const controller = container.get(UploaderController);
      expect(controller.container).toBe(container);
    });

    it('no longer owns the four upload-stack getters (moved to the container)', () => {
      const controller = makeController();
      expect((controller as unknown as Record<string, unknown>).secureUploadsManager).toBeUndefined();
      expect((controller as unknown as Record<string, unknown>).uploadEvents).toBeUndefined();
      expect((controller as unknown as Record<string, unknown>).attachUploaderScope).toBeUndefined();
    });

    it('destroy() tolerates never having attached the uploader scope', () => {
      const controller = makeController();
      expect(() => controller.destroy()).not.toThrow();
    });
  });
});
