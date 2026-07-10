import { EventBus } from '../EventBus';
import { Listeners } from '../host-subscription';
import { ConfigController } from './ConfigController';
import { LocaleController } from './LocaleController';
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
 */
export type UploaderControllerDeps = {
  events?: EventBus;
  config?: ConfigController;
  locale?: LocaleController;
  collection?: UploadCollectionController;
};

export class UploaderController {
  public readonly events: EventBus;
  public readonly config: ConfigController;
  public readonly locale: LocaleController;
  public readonly collection: UploadCollectionController;

  // ─── Solution (M8) ───
  // Source of truth for the v1 `*solution` key: the solution block's tag name,
  // published once by `LitSolutionBlock`, read by telemetry. `PubSubCompat`
  // routes the `*solution` key here.
  private _solution: string | null = null;
  private _solutionListeners = new Listeners();

  public constructor(deps: UploaderControllerDeps = {}) {
    this.events = deps.events ?? new EventBus();
    this.config = deps.config ?? new ConfigController();
    this.locale = deps.locale ?? new LocaleController();
    this.collection = deps.collection ?? new UploadCollectionController();
  }

  public get solution(): string | null {
    return this._solution;
  }

  /** Notifies only on an actual change (per-key change semantics). */
  public setSolution(name: string | null): void {
    if (this._solution === name) return;
    this._solution = name;
    this._solutionListeners.notify();
  }

  public subscribeSolution(listener: () => void): () => void {
    return this._solutionListeners.subscribe(listener);
  }

  public destroy(): void {
    this.events.destroy();
    this.config.destroy();
    this.locale.destroy();
    this.collection.destroy();
    this._solutionListeners.clear();
  }
}
