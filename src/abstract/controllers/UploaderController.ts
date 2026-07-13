import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import { applyInitialCrop } from '../applyInitialCrop';
import { EventBus, type UploaderEventKey, type UploaderEventPayload, UploaderEventType } from '../EventBus';
import { A11y } from '../managers/a11y';
import { LocaleManager } from '../managers/LocaleManager';
import { TelemetryManager } from '../managers/TelemetryManager';
import type { UploaderPublicApi } from '../UploaderPublicApi';
import { ClipboardController } from './ClipboardController';
import { ConfigController } from './ConfigController';
import { LocaleController } from './LocaleController';
import { RouterController } from './RouterController';
// The four uploader-scope classes are TYPE-ONLY imports (they erase at
// runtime): `UploaderController` is constructed for every ctx — including
// editor-only scopes that never upload — and a static value import here would
// drag the whole upload stack (`@uploadcare/upload-client` and friends) into
// bundles that can't tree-shake a reachable method body. The element layer
// (`LitUploaderBlock`), which only exists in upload-capable bundles, injects
// the constructors through `UploaderScopeDeps.controllers`.
import type { SecureUploadsController, SecureUploadsControllerDeps } from './SecureUploadsController';
import { UploadCollectionController } from './UploadCollectionController';
import type { UploadController, UploadControllerDeps } from './UploadController';
import type { UploadEventsController, UploadEventsControllerDeps } from './UploadEventsController';
import type { ValidationController, ValidationControllerDeps } from './ValidationController';

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
/**
 * The v1 shared-state (`*`-key, via the `$`/`PubSub` proxy) read/write bridges
 * that the upload stack needs — `ValidationController`'s `setCollectionErrors`
 * and `UploadEventsController`'s 8. Built by whoever creates the controller
 * (lit-side: `PubSubCompat._uploader()`, closing over that ctx's `pub`/`read`)
 * and handed in at construction time, rather than injected later at
 * `attachUploaderScope()` — so the controller's identity (and these bridges)
 * exist from birth, before an uploader element ever attaches. The controller
 * itself stays PubSub-free: it only ever calls these functions, never imports
 * `PubSub`.
 */
export type UploaderStateBridges = {
  /** Sink for collection-level errors — v1 wrote `this.$['*collectionErrors']`. */
  setCollectionErrors: ValidationControllerDeps['setCollectionErrors'];
  /** The live `*uploadTrigger` set (mutated in place on remove). */
  uploadTrigger: UploadEventsControllerDeps['uploadTrigger'];
  setUploadList: UploadEventsControllerDeps['setUploadList'];
  getCollectionState: UploadEventsControllerDeps['getCollectionState'];
  setCollectionState: UploadEventsControllerDeps['setCollectionState'];
  getCommonProgress: UploadEventsControllerDeps['getCommonProgress'];
  setCommonProgress: UploadEventsControllerDeps['setCommonProgress'];
  setGroupInfo: UploadEventsControllerDeps['setGroupInfo'];
  getCollectionErrors: UploadEventsControllerDeps['getCollectionErrors'];
};

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
  /** See `UploaderStateBridges` doc. Defaults to inert no-ops (editor-only scopes never attach an uploader). */
  stateBridges?: UploaderStateBridges;
};

/**
 * Every element-side (DOM/`PubSub`-touching) callback `attachUploaderScope`
 * needs to build `SecureUploadsController`, `UploadController`,
 * `ValidationController`, and `UploadEventsController` — the v1 shared-context
 * resolvers' closures, moved verbatim. Everything that can resolve purely from
 * the controller's own members (telemetry mirrors, `buildUploadOptions`,
 * `applyInitialCrop`) is built internally by `attachUploaderScope` instead and
 * does NOT appear here — see the field-by-field notes on each resolver below.
 *
 * Reuses each sub-controller's own `*Deps` field types (rather than
 * redeclaring them) so a signature change downstream is a compile error here,
 * not silent drift.
 *
 * M9n (Task 3) moved the 9 v1 shared-state (`*`-key) read/write bridges —
 * validation's `setCollectionErrors` and uploadEvents' 8 — out of this type
 * and into `UploaderStateBridges`, injected at controller construction
 * instead of here at attach time (see that type's doc).
 */
export type UploaderScopeDeps = {
  /**
   * The four sub-controller constructors, injected by the element layer (see
   * the import note above) so editor-only bundles never carry the upload
   * stack. Typed via `typeof X` type queries on the type-only imports, so the
   * instance types still flow into the getters below.
   */
  controllers: {
    SecureUploadsController: typeof SecureUploadsController;
    UploadController: typeof UploadController;
    ValidationController: typeof ValidationController;
    UploadEventsController: typeof UploadEventsController;
  };
  /** Debug logger — wired to the block's `debugPrint`. Shared by secureUploads + uploadController. */
  debug?: SecureUploadsControllerDeps['debug'];
  /** Snapshot of the registered plugin file hooks (bag.pluginManager). */
  getFileHooks: UploadControllerDeps['getFileHooks'];
  /** Resolves the public output entry (bag.api.getOutputItem) — shared by uploadController + uploadEvents. */
  getOutputItem: UploadEventsControllerDeps['getOutputItem'];
  /** The public API passed to validators (bag.api). */
  getApi: ValidationControllerDeps['getApi'];
  /** Fires the debounced `common-upload-failed` event — reads bag.eventEmitter + bag.api, kept verbatim (api isn't controller-owned). */
  emitCommonUploadFailed: ValidationControllerDeps['emitCommonUploadFailed'];
  /**
   * Telemetry-augmented emit — v1's `ctx.has('*eventEmitter')` teardown guard,
   * kept verbatim: it observes the pub-null pass that runs BEFORE
   * `UploaderController.destroy()`, and collapsing it onto `controller.emit`
   * would shift that teardown-suppression window.
   */
  emit: UploadEventsControllerDeps['emit'];
  getOutputCollectionState: UploadEventsControllerDeps['getOutputCollectionState'];
  /** Needs the shared-instances bag (`getOutputData(bag)`) — DOM-layer only. */
  getOutputData: UploadEventsControllerDeps['getOutputData'];
  /** Runs plugin `onAdd` hooks — needs `bag.wait('pluginManager')`. */
  runOnAddHooks: UploadEventsControllerDeps['runOnAddHooks'];
};

type UploaderScope = {
  secureUploadsManager: SecureUploadsController;
  uploadController: UploadController;
  validationManager: ValidationController;
  uploadEvents: UploadEventsController;
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
  // The upload stack — only constructed once an uploader is actually present
  // in the scope (`attachUploaderScope`, called by `LitUploaderBlock`). A
  // bare `<uc-config>` + provider ctx (no uploader tag) never gets one.
  private _uploaderScope: UploaderScope | null = null;
  // See `UploaderStateBridges` doc. Lives from construction — a scope that
  // never attaches an uploader (editor-only) simply never calls these.
  private readonly _stateBridges: UploaderStateBridges;

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
    this._stateBridges = deps.stateBridges ?? {
      setCollectionErrors: () => {},
      uploadTrigger: () => new Set(),
      setUploadList: () => {},
      getCollectionState: () => null,
      setCollectionState: () => {},
      getCommonProgress: () => 0,
      setCommonProgress: () => {},
      setGroupInfo: () => {},
      getCollectionErrors: () => [],
    };
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

  /**
   * Construct the upload stack — `SecureUploadsController`, `UploadController`,
   * `ValidationController`, `UploadEventsController` — behind the
   * uploader-present gate (only `LitUploaderBlock.initCallback` calls this; a
   * scope with just `<uc-config>` + a provider never does). Idempotent: a
   * second call is a no-op, matching `_addSharedContextInstance`'s
   * first-write-wins semantics. Inert once `destroy()` has run.
   *
   * Construction order is load-bearing: `uploadController` needs
   * `secureUploadsManager`; `uploadEvents` needs `validationManager` (and,
   * internally, `uploadController.buildUploadOptions()`).
   */
  public attachUploaderScope(deps: UploaderScopeDeps): void {
    if (this._uploaderScope || this._destroyed) {
      return;
    }

    const secureUploadsManager = new deps.controllers.SecureUploadsController({
      config: this.config,
      onResolverError: (error, context) => {
        // Same teardown race as `onUploadError` below: reporting never throws.
        try {
          this.telemetryManager.sendEventError(error, context);
        } catch (err) {
          deps.debug?.('telemetry unavailable for a resolver error report', err);
        }
      },
      debug: deps.debug,
    });

    const uploadController = new deps.controllers.UploadController({
      collection: this.collection,
      config: this.config,
      secureUploads: secureUploadsManager,
      getFileHooks: deps.getFileHooks,
      getOutputItem: deps.getOutputItem,
      onUploadError: (error, context) => {
        // An upload's async error handler can fire after the scope (and its
        // telemetry instance) is torn down — error *reporting* must never
        // throw, or the original failure becomes an unhandled rejection.
        try {
          this.telemetryManager.sendEventError(error, context);
        } catch (err) {
          deps.debug?.('telemetry unavailable for an upload error report', err);
        }
      },
      debug: deps.debug,
    });

    const validationManager = new deps.controllers.ValidationController({
      config: this.config,
      collection: this.collection,
      getApi: deps.getApi,
      setCollectionErrors: this._stateBridges.setCollectionErrors,
      emitCommonUploadFailed: deps.emitCommonUploadFailed,
      onValidatorError: (error, context) => {
        // Same teardown race as `onUploadError` above: reporting never throws.
        try {
          this.telemetryManager.sendEventError(error, context);
        } catch (err) {
          deps.debug?.('telemetry unavailable for a validator error report', err);
        }
      },
    });

    const uploadEvents = new deps.controllers.UploadEventsController({
      collection: this.collection,
      config: this.config,
      validation: validationManager,
      emit: deps.emit,
      getOutputItem: deps.getOutputItem,
      getOutputCollectionState: deps.getOutputCollectionState,
      getOutputData: deps.getOutputData,
      buildUploadOptions: () => uploadController.buildUploadOptions(),
      runOnAddHooks: deps.runOnAddHooks,
      applyInitialCrop: () => applyInitialCrop(this.collection, this.config.get('cropPreset')),
      uploadTrigger: this._stateBridges.uploadTrigger,
      setUploadList: this._stateBridges.setUploadList,
      getCollectionState: this._stateBridges.getCollectionState,
      setCollectionState: this._stateBridges.setCollectionState,
      getCommonProgress: this._stateBridges.getCommonProgress,
      setCommonProgress: this._stateBridges.setCommonProgress,
      setGroupInfo: this._stateBridges.setGroupInfo,
      getCollectionErrors: this._stateBridges.getCollectionErrors,
    });

    this._uploaderScope = { secureUploadsManager, uploadController, validationManager, uploadEvents };
    uploadEvents.observe();
  }

  private _requireUploaderScope<TKey extends keyof UploaderScope>(key: TKey): UploaderScope[TKey] {
    if (!this._uploaderScope) {
      throw new Error(`Unexpected error: UploaderController.${key} accessed before attachUploaderScope()`);
    }
    return this._uploaderScope[key];
  }

  public get secureUploadsManager(): SecureUploadsController {
    return this._requireUploaderScope('secureUploadsManager');
  }

  public get uploadController(): UploadController {
    return this._requireUploaderScope('uploadController');
  }

  public get validationManager(): ValidationController {
    return this._requireUploaderScope('validationManager');
  }

  public get uploadEvents(): UploadEventsController {
    return this._requireUploaderScope('uploadEvents');
  }

  public destroy(): void {
    this._destroyed = true;

    this.events.destroy();
    this.config.destroy();
    this.locale.destroy();

    // The uploader-scope stack tears down BEFORE `this.collection.destroy()`,
    // in reverse construction order: `UploadEventsController.unobserve()`
    // detaches its `observeCollection`/`observeProperties` subscriptions,
    // which must run while the collection they're registered against is
    // still the live, intact instance — destroying the collection first would
    // let its own teardown race those detaching observers.
    if (this._uploaderScope) {
      this._uploaderScope.uploadEvents.destroy();
      this._uploaderScope.validationManager.destroy();
      this._uploaderScope.uploadController.destroy();
      this._uploaderScope.secureUploadsManager.destroy();
    }

    this.collection.destroy();

    // Reverse construction order.
    this.clipboard.destroy();
    this.a11y.destroy();
    this.router.destroy();
    this.telemetryManager.destroy();
    this.eventEmitter.destroy();
    this.localeManager.destroy();

    // M9l follow-up: restore v1's throw-on-teardown-straddle parity — reading
    // `api` after destroy() must throw again, not keep returning a torn-down
    // instance.
    this._api = null;
  }
}
