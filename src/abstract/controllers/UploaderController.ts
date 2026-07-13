import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import { EventBus, type UploaderEventKey, type UploaderEventPayload, UploaderEventType } from '../EventBus';
import { LocaleManager } from '../managers/LocaleManager';
import { TelemetryManager } from '../managers/TelemetryManager';
import { ConfigController } from './ConfigController';
import { LocaleController } from './LocaleController';
import { RouterController } from './RouterController';
import { UploadCollectionController } from './UploadCollectionController';

/**
 * Root controller — one instance per uploader scope (keyed by `ctx-name` in
 * `UploaderRegistry`). Pure logic: it does NOT import from `lit` or touch the
 * DOM, so it is constructible and testable in isolation.
 *
 * This is the strangler engine that v1's `PubSub` facade delegates to. It
 * grows by one sub-controller per migration milestone (M1 `config`, M2
 * `locale`, M3 `collection`, …).
 *
 * - `events`: the typed event bus (wired to DOM events in a later milestone).
 * - `config`: source of truth for `*cfg/*` state — `PubSubCompat` routes the
 *   config namespace here.
 * - `locale`: source of truth for `*l10n/*` state — `PubSubCompat` routes the
 *   locale namespace here.
 * - `collection`: source of truth for the upload entries — the `*uploadCollection`
 *   shared instance resolves to this.
 *
 * Sub-controllers are constructor-injected (mirroring `ValidationController`'s
 * deps-object style): each defaults to a freshly-constructed instance, so
 * `new UploaderController()` keeps working, while tests and later milestones can
 * substitute a fake or share an existing instance. This is deliberately just
 * default-parameter injection — no container/decorators; the DOM layer already
 * has its own wiring via `@lit/context`.
 *
 * M9k also moves four of the five v1 ctx-scope managers here (construction +
 * teardown ownership): `localeManager`, `eventEmitter`, `telemetryManager`,
 * `router`. `PluginController` (the fifth) stays constructed by the DOM layer
 * (`LitBlock`) — it genuinely needs the PubSub ctx (`*lazyPlugins`, arbitrary
 * shared state) and the `*publicApi` shared instance, neither of which the
 * DOM-free controller can reach without importing `PubSub` here, which would
 * both create a circular import (`PubSubCompat` already imports
 * `UploaderController`) and break the "abstract/ touches no DOM" boundary in
 * spirit. See the M9k task report for the full audit.
 */
export type UploaderControllerDeps = {
  events?: EventBus;
  config?: ConfigController;
  locale?: LocaleController;
  collection?: UploadCollectionController;
  localeManager?: LocaleManager;
  eventEmitter?: EventEmitter;
  telemetryManager?: TelemetryManager;
  router?: RouterController;
};

export class UploaderController {
  public readonly events: EventBus;
  public readonly config: ConfigController;
  public readonly locale: LocaleController;
  public readonly collection: UploadCollectionController;
  public readonly localeManager: LocaleManager;
  public readonly eventEmitter: EventEmitter;
  public readonly telemetryManager: TelemetryManager;
  public readonly router: RouterController;

  // The solution (preset) identity of this uploader scope — a boot-time fact,
  // not reactive state: set once by the solution element, read lazily by
  // telemetry. Stored lowercased, payload-ready.
  private _solutionName: string | null = null;
  private _destroyed = false;

  public constructor(deps: UploaderControllerDeps = {}) {
    this.events = deps.events ?? new EventBus();
    this.config = deps.config ?? new ConfigController();
    this.locale = deps.locale ?? new LocaleController();
    this.collection = deps.collection ?? new UploadCollectionController();

    this.localeManager = deps.localeManager ?? new LocaleManager({ config: this.config, locale: this.locale });
    this.eventEmitter = deps.eventEmitter ?? new EventEmitter(this.events);
    this.telemetryManager =
      deps.telemetryManager ??
      new TelemetryManager({
        config: this.config,
        getSolution: () => this.solutionName,
        getActivity: () => this.router.currentActivity,
      });
    this.router =
      deps.router ??
      new RouterController({
        emit: (type, payload) => {
          // Matches v1's `LitBlock._routerEmit`: modal transitions debounce,
          // activity-change fires immediately.
          const debounce = type === UploaderEventType.MODAL_OPEN || type === UploaderEventType.MODAL_CLOSE;
          this.emit(type, payload, debounce ? { debounce: true } : undefined);
        },
      });
  }

  /**
   * Telemetry-augmented emit — matches v1 `LitBlock.emit`'s guard + payload-
   * function resolution exactly, plus `ChildBlock.emit`'s try/catch around the
   * telemetry mirror (teardown-safe: a send racing `destroy()` must never
   * throw back into the caller). A silent no-op once destroyed.
   */
  public emit<T extends UploaderEventKey>(
    type: T,
    payload?: UploaderEventPayload[T] | (() => UploaderEventPayload[T]),
    options?: { debounce?: boolean | number },
  ): void {
    if (this._destroyed) {
      return;
    }

    this.eventEmitter.emit(type, payload, options);

    const resolvedPayload = typeof payload === 'function' ? payload() : payload;

    try {
      this.telemetryManager.sendEvent({
        eventType: type,
        payload: (resolvedPayload ?? undefined) as Record<string, unknown> | undefined,
      });
    } catch {
      // Telemetry may already be torn down — reporting must never throw.
    }
  }

  public get solutionName(): string | null {
    return this._solutionName;
  }

  /**
   * Register the solution (preset) owning this scope. Several solutions may
   * share one `ctx-name` (a supported composition — e.g. an uploader plus a
   * standalone editor); the most recently initialized one identifies the
   * scope, matching v1's `pub('*solution', …)` last-writer semantics.
   */
  public setSolutionName(name: string): void {
    this._solutionName = name.toLowerCase();
  }

  public destroy(): void {
    this._destroyed = true;

    this.events.destroy();
    this.config.destroy();
    this.locale.destroy();
    this.collection.destroy();

    // Reverse construction order.
    this.router.destroy();
    this.telemetryManager.destroy();
    this.eventEmitter.destroy();
    this.localeManager.destroy();
  }
}
