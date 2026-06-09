import { ACTIVITY_TYPES } from '../../lit/activity-constants';
import { UploaderEventType } from '../EventBus';
import { Listeners } from '../host-subscription';

/**
 * Emit the router's documented events. Activity ids are typed as `string` here
 * (the honest runtime type — plugins register arbitrary ids); the documented
 * `ActivityType` view is bridged where this is wired to the block's `emit`.
 */
type RouterEmit = {
  (type: typeof UploaderEventType.ACTIVITY_CHANGE, payload: { activity: string | null }): void;
  (type: typeof UploaderEventType.MODAL_OPEN, payload: { modalId: string }): void;
  (type: typeof UploaderEventType.MODAL_CLOSE, payload: { modalId: string; hasActiveModals: boolean }): void;
};

/** A registered source as the init flow needs it (subset of the plugin source). */
type RouterSource = { id: string; expand?: () => string[]; onSelect: () => void };

type AfterFileAddContext = { historyLength: number };
type AfterFileAddHook = (ctx: AfterFileAddContext) => boolean;

export type RouterControllerDeps = {
  emit: RouterEmit;
  /** Visibility gate: may this activity be opened right now? (e.g. UploadList only with files) */
  couldOpenActivity: (activity: string) => boolean;
  /** Whether an activity is recorded in history (v1 `historyTracked` blocks). */
  isHistoryTracked: (activity: string) => boolean;
  /** Solution exit activity (`--cfg-done-activity`). */
  getDoneActivity: () => string | null;
  /** Are there upload entries? (drives `initFlow`). */
  hasFiles: () => boolean;
  /** Configured `sourceList`. */
  getSourceList: () => string[];
  /** Resolves once plugins (and their sources) are registered. */
  pluginsReady: () => Promise<void>;
  /** Currently-registered plugin sources. */
  getSources: () => readonly RouterSource[];
};

/**
 * DOM-free dual-slot router — the v2 replacement for the activity/modal engine
 * (v1's `LitActivityBlock` FSM + `ModalManager` + `RouterHooksLayer` + the
 * `*currentActivity` state + the public-API flow methods).
 *
 * Two slots:
 * - `activity` (background): which activity is current. Activity elements show
 *   when `router.activity === their type`.
 * - `modal` (foreground): which activity's modal is shown. `<uc-modal>` shows
 *   when `router.modal === its id`. A single foreground slot (v1 ran one modal
 *   at a time in practice).
 *
 * Holds the state + transition logic; DOM concerns (element show/hide, dispatch)
 * live in the UI bridge that observes this controller. Collaborators are
 * injected, so it runs without a DOM and is unit-testable.
 */
export class RouterController {
  private _deps: RouterControllerDeps;
  private _activity: string | null = null;
  private _params: Record<string, unknown> = {};
  private _modal: string | null = null;
  private _history: string[] = [];
  private _afterFileAddHooks: AfterFileAddHook[] = [];
  private _listeners = new Listeners();

  public constructor(deps: RouterControllerDeps) {
    this._deps = deps;
  }

  // ─── State accessors ───
  public get activity(): string | null {
    return this._activity;
  }
  public get params(): Record<string, unknown> {
    return this._params;
  }
  public get modal(): string | null {
    return this._modal;
  }
  public get history(): readonly string[] {
    return this._history;
  }

  /** Observe any router state change (activity/modal/params/history). */
  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  // ─── Activity slot ───

  /** Set the background activity (does not open a modal — v1 parity). */
  public setActivity(activity: string | null, params: Record<string, unknown> = {}): void {
    this._params = params;
    if (this._activity === activity) {
      this._listeners.notify();
      return;
    }
    this._activity = activity;
    if (activity) {
      this._flushHistory(activity);
    } else {
      this._history = [];
    }
    this._listeners.notify();
    if (activity) {
      this._deps.emit(UploaderEventType.ACTIVITY_CHANGE, { activity });
    }
  }

  public getCurrentActivity(): string | null {
    return this._activity;
  }

  private _flushHistory(activity: string): void {
    if (this._history.length > 10) {
      this._history = this._history.slice(this._history.length - 11, this._history.length - 1);
    }
    if (activity && this._deps.isHistoryTracked(activity) && this._history[this._history.length - 1] !== activity) {
      this._history.push(activity);
    }
  }

  // ─── Modal slot ───

  public openModal(id: string): void {
    if (!id) return;
    this._modal = id;
    this._listeners.notify();
    this._deps.emit(UploaderEventType.MODAL_OPEN, { modalId: id });
  }

  public closeModal(id: string): void {
    if (this._modal !== id) return;
    this._modal = null;
    this._listeners.notify();
    this._deps.emit(UploaderEventType.MODAL_CLOSE, { modalId: id, hasActiveModals: false });
  }

  public closeAllModals(): void {
    const closing = this._modal;
    if (!closing) return;
    this._modal = null;
    this._listeners.notify();
    this._deps.emit(UploaderEventType.MODAL_CLOSE, { modalId: closing, hasActiveModals: false });
  }

  /** Open/close the current activity's modal (documented `setModalState`). */
  public setModalState(opened: boolean): void {
    if (!opened) {
      const activity = this._activity;
      if (activity) this.closeModal(activity);
      this.setActivity(null);
      return;
    }
    if (!this._activity) {
      console.warn(`Can't open modal without current activity. Please use "setCurrentActivity" method first.`);
      return;
    }
    this.openModal(this._activity);
  }

  // ─── Flows ───

  /** Go back through history, honoring `couldOpenActivity`; close all if none. */
  public historyBack(): void {
    const history = this._history;
    let next = history.pop() ?? null;
    // Skip entries equal to the current activity; stop when history is
    // exhausted (`next === null`) — guarding the `activity === null` case from
    // looping forever.
    while (next !== null && next === this._activity) {
      next = history.pop() ?? null;
    }

    const allowed = next ? this._deps.couldOpenActivity(next) : false;
    const target = allowed ? next : null;

    this.setActivity(target);
    this._history = history;
    if (target) {
      this.openModal(target);
    } else {
      this.closeAllModals();
    }
  }

  /** Solution exit (documented `doneFlow`). */
  public doneFlow(): void {
    const done = this._deps.getDoneActivity();
    this.setActivity(done);
    this._history = done ? [done] : [];
    if (!this._activity) {
      this.closeAllModals();
    }
  }

  /** Open the start/upload-list flow (documented `initFlow`). */
  public async initFlow(force = false): Promise<void> {
    if (this._deps.hasFiles() && !force) {
      this._openActivityAsModal(ACTIVITY_TYPES.UPLOAD_LIST);
      return;
    }

    const sourceList = this._deps.getSourceList();
    if (sourceList.length === 1) {
      await this._deps.pluginsReady();
      const sources = this._deps.getSources();
      const registered = sources.find((s) => s.id === sourceList[0]);
      if (registered) {
        const expandedIds = registered.expand?.() ?? [sourceList[0]];
        if (expandedIds.length === 1) {
          (sources.find((s) => s.id === expandedIds[0]) ?? registered).onSelect();
        } else {
          this._openActivityAsModal(ACTIVITY_TYPES.START_FROM);
        }
        return;
      }
      if (this._activity) this.openModal(this._activity);
    } else {
      this._openActivityAsModal(ACTIVITY_TYPES.START_FROM);
    }
  }

  private _openActivityAsModal(activity: string): void {
    this.setActivity(activity);
    this.openModal(activity);
  }

  // ─── After-file-add hooks (v1 RouterHooksLayer) ───

  public registerAfterFileAddHook(hook: AfterFileAddHook): () => void {
    this._afterFileAddHooks.push(hook);
    return () => {
      this._afterFileAddHooks = this._afterFileAddHooks.filter((h) => h !== hook);
    };
  }

  public navigateAfterFileAdd(): void {
    const handled = this._afterFileAddHooks.some((hook) => hook({ historyLength: this._history.length }));
    if (!handled) {
      this._openActivityAsModal(ACTIVITY_TYPES.UPLOAD_LIST);
    }
  }

  public destroy(): void {
    this._listeners.clear();
    this._afterFileAddHooks = [];
  }
}
