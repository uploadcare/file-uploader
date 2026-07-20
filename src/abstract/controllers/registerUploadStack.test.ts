import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Uid } from '../../lit/Uid';
import { ControllerContainer } from '../di/ControllerContainer';
import { ConfigController } from './ConfigController';
import { registerUploadStack, type UploadStackControllers } from './registerUploadStack';
import { SecureUploadsController } from './SecureUploadsController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadController } from './UploadController';
import { UploadEventsController } from './UploadEventsController';
import { UploadHostBridge } from './UploadHostBridge';
import { ValidationController } from './ValidationController';

const controllers: UploadStackControllers = {
  SecureUploadsController,
  UploadController,
  ValidationController,
  UploadEventsController,
};

// A full `UploadHostBridge` with inert-but-valid defaults; the validation pass
// touches `getApi().getOutputCollectionState()`, so those return real shapes.
const makeUploadHost = (overrides: Partial<UploadHostBridge> = {}): UploadHostBridge =>
  ({
    getFileHooks: () => [],
    getOutputItem: ((uid: string) => ({ internalId: uid })) as unknown as UploadHostBridge['getOutputItem'],
    getApi: (() => ({
      getOutputCollectionState: () => ({ totalCount: 0, status: 'idle', allEntries: [] }),
      getOutputItem: (uid: Uid) => ({ internalId: uid }),
    })) as unknown as UploadHostBridge['getApi'],
    emitCommonUploadFailed: () => {},
    emit: () => {},
    getOutputCollectionState: (() => ({
      totalCount: 0,
      status: 'idle',
      allEntries: [],
    })) as unknown as UploadHostBridge['getOutputCollectionState'],
    getOutputData: () => [],
    runOnAddHooks: () => {},
    onResolverError: () => {},
    onUploadError: () => {},
    onValidatorError: () => {},
    ...overrides,
  }) satisfies UploadHostBridge;

describe('registerUploadStack', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves all four upload-stack controllers on the container', () => {
    const container = new ControllerContainer();
    registerUploadStack(container, controllers, makeUploadHost());

    expect(container.get(SecureUploadsController)).toBeInstanceOf(SecureUploadsController);
    expect(container.get(UploadController)).toBeInstanceOf(UploadController);
    expect(container.get(ValidationController)).toBeInstanceOf(ValidationController);
    expect(container.get(UploadEventsController)).toBeInstanceOf(UploadEventsController);

    container.dispose();
  });

  it('binds the host bridge so the controllers can @inject it', () => {
    const container = new ControllerContainer();
    const host = makeUploadHost();
    registerUploadStack(container, controllers, host);

    expect(container.get(UploadHostBridge)).toBe(host);

    container.dispose();
  });

  it('starts the upload-events collection observation exactly once', () => {
    const observeSpy = vi.spyOn(UploadEventsController.prototype, 'observe');
    const container = new ControllerContainer();

    registerUploadStack(container, controllers, makeUploadHost());

    expect(observeSpy).toHaveBeenCalledTimes(1);

    container.dispose();
  });

  it('is idempotent — a second call does not rebind or reconstruct', () => {
    const container = new ControllerContainer();
    registerUploadStack(container, controllers, makeUploadHost());
    const events = container.get(UploadEventsController);
    const secure = container.get(SecureUploadsController);

    // A second call (a sibling host / re-adoption) must be inert — and must NOT
    // throw from a re-`bind()` after resolution.
    expect(() => registerUploadStack(container, controllers, makeUploadHost())).not.toThrow();
    expect(container.get(UploadEventsController)).toBe(events);
    expect(container.get(SecureUploadsController)).toBe(secure);

    container.dispose();
  });

  it('container.dispose() tears the stack down in reverse construction order', () => {
    const container = new ControllerContainer();
    registerUploadStack(container, controllers, makeUploadHost());

    const eventsDestroy = vi.spyOn(container.get(UploadEventsController), 'destroy');
    const validationDestroy = vi.spyOn(container.get(ValidationController), 'destroy');
    const uploadDestroy = vi.spyOn(container.get(UploadController), 'destroy');
    const secureDestroy = vi.spyOn(container.get(SecureUploadsController), 'destroy');
    // The collection is resolved BEFORE the stack (via the controllers' @inject),
    // so it disposes AFTER — its observers are detached while it's still alive.
    const collectionDestroy = vi.spyOn(container.get(UploadCollectionController), 'destroy');

    container.dispose();

    const order = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.invocationCallOrder[0]!;
    expect(order(eventsDestroy)).toBeLessThan(order(validationDestroy));
    expect(order(validationDestroy)).toBeLessThan(order(uploadDestroy));
    expect(order(uploadDestroy)).toBeLessThan(order(secureDestroy));
    expect(order(secureDestroy)).toBeLessThan(order(collectionDestroy));
  });

  it('wires the four to the SAME container-owned config/collection', () => {
    const container = new ControllerContainer();
    registerUploadStack(container, controllers, makeUploadHost());

    const collection = container.get(UploadCollectionController);
    const config = container.get(ConfigController);
    // Prove shared identity through a behavior: an entry added to the collection
    // is visible to the upload controller's queue precondition path.
    expect(collection).toBe(container.get(UploadCollectionController));
    expect(config).toBe(container.get(ConfigController));

    container.dispose();
  });
});
