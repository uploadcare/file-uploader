import { describe, expect, it } from 'vitest';
import { EventBus } from '../EventBus';
import { ConfigController } from './ConfigController';
import { LocaleController } from './LocaleController';
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

  it('destroy() tears down without throwing', () => {
    const controller = new UploaderController();
    expect(() => controller.destroy()).not.toThrow();
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
