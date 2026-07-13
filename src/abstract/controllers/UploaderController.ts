import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import { EventBus, type UploaderEventKey, type UploaderEventPayload, UploaderEventType } from '../EventBus';
import { A11y } from '../managers/a11y';
import { LocaleManager } from '../managers/LocaleManager';
import { TelemetryManager } from '../managers/TelemetryManager';
import type { UploaderPublicApi } from '../UploaderPublicApi';
import { ClipboardController } from './ClipboardController';
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
 * M9k moved four of the six v1 ctx-scope managers here (construction +
 * teardown ownership): `localeManager`, `eventEmitter`, `telemetryManager`,
 * `router`. M9l (Task 3) moves the remaining two that don't need the PubSub
 * ctx: `a11y`, `clipboard`. `PluginController` stays constructed by the DOM
 * layer (`LitBlock`) — it genuinely needs the PubSub ctx (`*lazyPlugins`,
 * arbitrary shared state) and the `*publicApi` shared instance, neither of
 * which the DOM-free controller can reach without importing `PubSub` here,
 * which would both create a circular import (`PubSubCompat` already imports
 * `UploaderController`) and break the "abstract/ touches no DOM" boundary in
 * spirit. See the M9k task report for the full audit.
 *
 * `clipboard`'s add-file callbacks need the uploader-scope public API
 * (`*publicApi`), which is itself DOM-layer-constructed (`LitUploaderBlock`,
 * since `UploaderPublicApi` needs the shared-instances bag) — the controller
 * does not, and must not, construct it. Instead the controller holds a
 * settable `api` reference (`setApi`, mirroring the existing `setSolutionName`
 * pattern): `LitUploaderBlock` calls it right after constructing `*publicApi`.
 * `clipboard`'s callbacks read `this.api` lazily, at paste time — which is
 * always after `setApi` has run, since a paste can only ever add a file
 * through an already-constructed uploader element.
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
  a11y?: A11y;
  clipboard?: ClipboardController;
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
  public readonly a11y: A11y;
  public readonly clipboard: ClipboardController;

  // The solution (preset) identity of this uploader scope — a boot-time fact,
  // not reactive state: set once by the solution element, read lazily by
  // telemetry. Stored lowercased, payload-ready.
  private _solutionName: string | null = null;
  // The uploader-scope public API — element-constructed (see class doc),
  // handed to the controller once it exists. Only `clipboard`'s add-file
  // callbacks read this, and only at paste time.
  private _api: UploaderPublicApi | null = null;
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
    this.a11y = deps.a11y ?? new A11y();
    this.clipboard =
      deps.clipboard ??
      new ClipboardController({
        getPasteScope: () => this.config.get('pasteScope'),
        getCurrentActivity: () => this.router.currentActivity,
        addFileFromObject: (file, options) => this.api.addFileFromObject(file, options),
        addFileFromUrl: (url, options) => this.api.addFileFromUrl(url, options),
        onFileAdd: () => this.router.traverse('onFileAdd'),
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

  /**
   * The uploader-scope public API — see the class doc. Throws if read before
   * `setApi()` has run (parity with v1's `getSharedInstance` default of
   * `isRequired: true`: reaching a paste handler without an API is a bug, not
   * a silent no-op).
   */
  public get api(): UploaderPublicApi {
    if (!this._api) {
      throw new Error('Unexpected error: UploaderController.api accessed before setApi()');
    }
    return this._api;
  }

  /** Called once by `LitUploaderBlock` right after constructing `*publicApi`. */
  public setApi(api: UploaderPublicApi): void {
    this._api = api;
  }

  public destroy(): void {
    this._destroyed = true;

    this.events.destroy();
    this.config.destroy();
    this.locale.destroy();
    this.collection.destroy();

    // Reverse construction order.
    this.clipboard.destroy();
    this.a11y.destroy();
    this.router.destroy();
    this.telemetryManager.destroy();
    this.eventEmitter.destroy();
    this.localeManager.destroy();
  }
}
