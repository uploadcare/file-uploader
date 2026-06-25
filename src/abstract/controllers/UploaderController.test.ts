import { describe, expect, it } from 'vitest';
import { EventBus } from '../EventBus';
import { UploaderController } from './UploaderController';

describe('UploaderController', () => {
  it('constructs with an event bus', () => {
    const controller = new UploaderController();
    expect(controller.events).toBeInstanceOf(EventBus);
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
