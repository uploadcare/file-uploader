import { ACTIVITY_TYPES, type ActivityId } from '../activity-constants';
import { controllerLogger } from '../controllerLogger';
import { inject } from '../di/inject';
import { signalState } from '../di/signalState';
import { type UploaderEventKey, type UploaderEventPayload, UploaderEventType } from '../EventBus';
import { EventEmitter } from '../EventEmitter';
import { Listeners, type ObserveOptions } from '../host-subscription';
import { lazy } from '../logger';

export type EdgeTarget = ActivityId | null;

/** The navigation intents resolvable via {@link RouterController.traverse}. */
export type NavigationEdge = 'onBack' | 'onCancel' | 'onClose' | 'onDone' | 'onFileAdd';

/** Per-preset routing config, set by the solution via {@link RouterController.configure}. */
export interface RouteTable {
  /** Activity to land on after a completed flow (preset-specific). */
  doneActivity?: ActivityId | null;
}

/** An `onFileAdd` interceptor: a target (or `null` to close everything) overrides the default; `undefined` defers. */
type FileAddHook = () => EdgeTarget | undefined;

/**
 * Dual-slot router. Tracks two independent activity slots:
 *
 * - `activity` (background): what's rendered inline in the host (minimal's
 *   trigger, inline's picker).
 * - `modal` (foreground): which activity is open in a modal. May be `null` or
 *   differ from `activity` (minimal: background `start-from` trigger +
 *   foreground `camera` modal).
 *
 * `<uc-modal>` opens when `router.modal === its id`. DOM-free + unit-testable:
 * collaborators are injected and the only side effect is the injected `emit`.
 */
export class RouterController {
  // Per-ctx logger: `warn`/`error` always print, prefixed with THIS ctx's name
  // (resolved lazily at log time via the container that built this instance).
  private readonly _log = controllerLogger(this, 'router');
  // Thunked `@inject` because the module graph around the event surface is
  // circular-prone; resolution is lazy so there is zero construction cycle. Telemetry observes the bus, so
  // there is NO telemetry mirror here — `_emit` is pure dispatch + debounce.
  @inject(() => EventEmitter) private readonly _eventEmitter!: EventEmitter;
  private _listeners = new Listeners();
  private _table: RouteTable = {};
  // The three slots are signal-backed so `SignalWatcher` blocks track them; `subscribe()` readers get the coarse
  // `_listeners.notify()`. `_transition` is the only writer of all three.
  // The background slot.
  @signalState() private _activity: ActivityId | null = null;
  // The foreground (modal) slot. Its own signal: a modal opening on the background activity's id leaves
  // `_currentActivity` unchanged.
  @signalState() private _modal: ActivityId | null = null;
  // The effective activity, `_modal ?? _activity`.
  @signalState() private _currentActivity: ActivityId | null = null;
  // Signal-backed, so a tracked reader sees new params even when the activity stays the same (one external activity
  // switching sources).
  @signalState() private _params: Record<string, unknown> = {};
  private _history: ActivityId[] = [];
  private _fileAddHooks: FileAddHook[] = [];
  // Set while a `reportWhenShown` navigation runs.
  private _holdUnshown = false;
  // The activity whose `ACTIVITY_CHANGE` waits for its block to mount (see `reportWhenShown`).
  private _unreported: ActivityId | null = null;

  /**
   * Emit a router event to the container-owned {@link EventEmitter}, debouncing
   * modal open/close (activity-change fires immediately). Telemetry sees the
   * already-debounced bus event since it observes the bus.
   */
  private _emit<T extends UploaderEventKey>(type: T, payload: UploaderEventPayload[T]): void {
    if (type === UploaderEventType.MODAL_OPEN || type === UploaderEventType.MODAL_CLOSE) {
      this._eventEmitter.emit(type, payload, { debounce: true });
    } else {
      this._eventEmitter.emit(type, payload);
    }
  }

  // ─── State (reactive reads) ───
  public get activity(): ActivityId | null {
    return this._activity;
  }
  /**
   * The foreground modal slot, or `null` when no modal is open. Backed by a
   * signal, so reading it inside a `SignalWatcher` update auto-tracks and a
   * later open/close re-runs that consumer (see `_modal`).
   */
  public get modal(): ActivityId | null {
    return this._modal;
  }
  /**
   * The single "effective" activity — the foreground modal if one is open,
   * otherwise the background activity: what activity blocks activate on and
   * what most readers want.
   */
  public get currentActivity(): ActivityId | null {
    return this._currentActivity;
  }
  public get params(): Readonly<Record<string, unknown>> {
    return this._params;
  }
  public get history(): readonly ActivityId[] {
    return this._history;
  }
  public get canGoBack(): boolean {
    return this._history.length > 0;
  }
  /** The activity to land on after a completed flow, configured per preset. */
  public get doneActivity(): ActivityId | null {
    return this._table.doneActivity ?? null;
  }

  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  /**
   * Atomic subscription to the effective activity (`modal ?? activity`): fires
   * only when `currentActivity` actually changes, not on every router notify
   * (params, a slot change that leaves it the same). Pass `{ immediate: true }`
   * to also fire once with the current value on subscribe. The router analogue
   * of `ConfigController.observe`.
   */
  public observeCurrentActivity(listener: (activity: ActivityId | null) => void, options?: ObserveOptions): () => void {
    return this._listeners.observe(() => this.currentActivity, listener, options);
  }

  /** Per-preset routing config (solution-level), e.g. the post-flow done activity. */
  public configure(table: RouteTable): void {
    this._table = { ...table };
    this._log.debug(lazy(() => [`configure: done activity = ${this._table.doneActivity ?? 'none'}`]));
  }

  // ─── Guards ───
  private _guards = new Map<ActivityId, () => boolean>();

  /**
   * Register a guard for an activity: it may only become / stay the current
   * activity while `canActivate()` returns true. The router blocks navigation
   * into a guarded-out activity, and `revalidate()` leaves one that no longer
   * holds (e.g. the upload list once it empties). Returns an unregister fn.
   */
  public guard(activityId: ActivityId, canActivate: () => boolean): () => void {
    this._guards.set(activityId, canActivate);
    this._log.debug(lazy(() => [`guard registered: "${activityId}"`]));
    return () => {
      if (this._guards.get(activityId) === canActivate) {
        this._guards.delete(activityId);
        this._log.debug(lazy(() => [`guard unregistered: "${activityId}"`]));
      }
    };
  }

  private _canActivate(id: EdgeTarget): boolean {
    if (id === null) return true;
    const guard = this._guards.get(id);
    if (!guard) return true;
    // Isolate-and-warn (AGENTS.md #3): a throwing guard must not crash
    // navigation/`revalidate`; treat it as "cannot activate" so it fails safe.
    try {
      return guard();
    } catch (err) {
      this._log.warn(`router guard for "${id}" threw; treating the activity as not activatable`, err);
      return false;
    }
  }

  /**
   * Re-evaluate the current activity against its guard; if it no longer holds,
   * navigate back. Call after external state changes a guard depends on (the
   * upload list calls this when its collection changes).
   */
  public revalidate(): void {
    if (!this._canActivate(this.currentActivity)) {
      this.back();
    }
  }

  // ─── Mounted activities ───

  // Activity blocks (ActivityChildBlock) report themselves here on adoption and
  // release, for "is this activity's block mounted?" waits. Refcounted — the
  // same activityType can be mounted in several slots at once (e.g. minimal's
  // two <uc-start-from>).
  private _mountedActivities = new Map<ActivityId, number>();

  /** Report a mounted activity block. Returns the matching un-mount call. */
  public activityBlockMounted(activityType: ActivityId): () => void {
    this._mountedActivities.set(activityType, (this._mountedActivities.get(activityType) ?? 0) + 1);
    if (this._unreported === activityType && this._currentActivity === activityType) {
      this._unreported = null;
      this._emit(UploaderEventType.ACTIVITY_CHANGE, { activity: activityType });
    }
    this._listeners.notify();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = (this._mountedActivities.get(activityType) ?? 1) - 1;
      if (next <= 0) this._mountedActivities.delete(activityType);
      else this._mountedActivities.set(activityType, next);
      this._listeners.notify();
    };
  }

  public hasMountedActivity(activityType: ActivityId): boolean {
    return this._mountedActivities.has(activityType);
  }

  // ─── Hooks ───
  public readonly hooks = {
    onFileAdd: (h: FileAddHook): (() => void) => {
      this._fileAddHooks.push(h);
      return () => {
        this._fileAddHooks = this._fileAddHooks.filter((x) => x !== h);
      };
    },
  };

  // ─── Navigation ───

  /**
   * Per-preset strategy: given a navigation target, decide whether it goes in
   * the background (`activity`) or foreground (`modal`) slot. Defaults to
   * `'background'` (inline-preset behavior); the Uploader element overrides it
   * per preset (regular → always foreground, inline → always background,
   * minimal → `upload-list` background, else foreground).
   */
  public navigationStrategy: (to: ActivityId) => 'background' | 'foreground' = () => 'background';

  /**
   * Navigate to `to` via the preset `navigationStrategy`. `navigate(null)`
   * closes everything.
   */
  public navigate(to: EdgeTarget, params: Record<string, unknown> = {}): void {
    if (to === null) {
      this._params = params;
      this._transition(null, null);
      return;
    }
    // A guarded-out activity can't be entered (e.g. an empty upload list);
    // refuse the navigation and stay where we are — leaving `_params` untouched
    // so readers never observe params for an activity we didn't actually enter.
    if (!this._canActivate(to)) {
      this._log.debug(lazy(() => [`navigate to "${to}" refused (guard)`]));
      return;
    }
    this._params = params;
    // A background target closes any open modal first — the inline content is
    // the focus now; a foreground target leaves the background slot untouched.
    const slot = this.navigationStrategy(to);
    this._log.debug(lazy(() => [`strategy for "${to}": ${slot}`]));
    if (slot === 'background') {
      this._transition(to, null);
    } else {
      this._transition(this._activity, to);
    }
  }

  /**
   * Set the background activity directly (preset init), bypassing `navigationStrategy`.
   * `params` is optional — omit it to change only the background slot without
   * clobbering the current activity's params (e.g. a preset reacting to the
   * upload list while a modal is open in the foreground slot).
   */
  public setActivity(to: EdgeTarget, params?: Record<string, unknown>): void {
    this._log.debug(lazy(() => [`set activity (direct): ${to ?? 'null'}`]));
    if (!this._canActivate(to)) {
      return;
    }
    if (params !== undefined) {
      this._params = params;
    }
    this._transition(to, this._modal);
  }

  /**
   * Apply a new pair of slot values, emitting the documented events for the
   * transitions that actually happened:
   * - `MODAL_OPEN` for the activity the modal slot now shows,
   * - `MODAL_CLOSE` for the one it stopped showing, with `hasActiveModals` set when it switched rather than closed,
   * - `ACTIVITY_CHANGE` whenever the *effective* activity changes.
   * Always notifies subscribers, so params-only updates still re-render.
   */
  private _transition(nextActivity: EdgeTarget, nextModal: EdgeTarget): void {
    const prevActivity = this._activity;
    const prevModal = this._modal;
    const prevEffective = this._currentActivity;
    this._activity = nextActivity;
    this._modal = nextModal;
    const nextEffective = this._modal ?? this._activity;
    this._currentActivity = nextEffective;

    // Per-slot debug logs (verbose): flag the background vs the foreground (modal)
    // slot explicitly, so a background change while a modal is open (which leaves
    // the *effective* activity unchanged) is still visible.
    if (nextActivity !== prevActivity) {
      this._log.debug(lazy(() => [`background activity: ${prevActivity ?? 'none'} → ${nextActivity ?? 'none'}`]));
    }
    if (nextModal !== prevModal) {
      this._log.debug(lazy(() => [`modal activity: ${prevModal ?? 'none'} → ${nextModal ?? 'none'}`]));
    }

    // NEXT-MAJOR(router): fire these only when the dialog opens and closes; a screen change is `activity-change`.
    // Kept for 1.x compat.
    // Each activity shown in the modal counts as a modal of its own, as in v1: switching the open modal to another
    // activity opens the new one, then closes the old one while the new one is still active.
    if (nextModal !== prevModal) {
      if (nextModal !== null) {
        this._emit(UploaderEventType.MODAL_OPEN, { modalId: nextModal });
      }
      if (prevModal !== null) {
        this._emit(UploaderEventType.MODAL_CLOSE, { modalId: prevModal, hasActiveModals: nextModal !== null });
      }
    }

    if (nextEffective !== prevEffective) {
      this._pushHistory(nextEffective);
      if (this._holdUnshown && nextEffective !== null && !this._mountedActivities.has(nextEffective)) {
        this._unreported = nextEffective;
      } else {
        this._unreported = null;
        this._emit(UploaderEventType.ACTIVITY_CHANGE, { activity: nextEffective });
      }
    }
    this._listeners.notify();
  }

  /**
   * v1-compatible history: each activated activity pushes itself; going to
   * `null` clears. `history.length > 0` answers "navigated to any activity
   * since the last close" — DynamicBtn uses it to decide the post-file-add modal.
   */
  private _pushHistory(to: EdgeTarget): void {
    if (to === null) {
      this._history = [];
      return;
    }
    if (this._history[this._history.length - 1] === to) return;
    this._history.push(to);
    if (this._history.length > 10) this._history.shift();
  }

  /**
   * Run `navigation`, holding its `ACTIVITY_CHANGE` until the new activity's block mounts: as in v1, which reported an
   * activity when its block activated, an activity nothing in the ctx shows is switched to but not reported. The held
   * report is dropped once the activity changes again.
   */
  public reportWhenShown(navigation: () => void): void {
    this._holdUnshown = true;
    try {
      navigation();
    } finally {
      this._holdUnshown = false;
    }
  }

  /** Open a modal for `id` without touching the background activity. */
  public openModal(id: ActivityId, params?: Record<string, unknown>): void {
    if (!this._canActivate(id)) {
      return;
    }
    if (params !== undefined) {
      this._params = params;
    }
    this._transition(this._activity, id);
  }

  /**
   * Navigate to `to` with a fresh history, as if the flow started there; `back()` then has nowhere to go. A restart
   * that leaves the activity where it was (already there, or `to` refused by its guard) still reports it with
   * `ACTIVITY_CHANGE`, as v1's `doneFlow()` did.
   */
  public restart(to: ActivityId): void {
    const prev = this._currentActivity;
    this._history = [];
    this.navigate(to);
    if (this._currentActivity !== prev) return;
    // Already there: the navigation changed nothing, so nothing pushed it.
    if (this._history.length === 0 && prev === to) {
      this._history.push(to);
    }
    this._emit(UploaderEventType.ACTIVITY_CHANGE, { activity: prev });
  }

  /** Close the foreground modal; keeps the background activity. */
  public closeModal(): void {
    this._transition(this._activity, null);
  }

  /** Close everything — both the modal and the background activity slot. */
  public close(): void {
    this.navigate(null);
  }

  /**
   * Express a navigation *intent* and let the router resolve it — the way
   * activities and plugins should navigate instead of calling `back()`/`close()`
   * directly:
   * - `onBack` / `onCancel` → {@link back},
   * - `onClose` → {@link close},
   * - `onDone` → navigate to the configured {@link doneActivity},
   * - `onFileAdd` → the first `hooks.onFileAdd` decision, else `upload-list`.
   */
  public traverse(edge: NavigationEdge): void {
    this._log.debug(lazy(() => [`traverse "${edge}"`]));
    switch (edge) {
      case 'onBack':
      case 'onCancel':
        this.back();
        break;
      case 'onClose':
        this.close();
        break;
      case 'onDone':
        this.navigate(this.doneActivity);
        break;
      case 'onFileAdd':
        this.navigate(this._resolveFileAdd());
        break;
      default:
        // A new edge that isn't handled here fails to compile.
        edge satisfies never;
    }
  }

  /** The first `onFileAdd` hook's decision, or the upload list when every hook defers. A throwing hook is skipped. */
  private _resolveFileAdd(): EdgeTarget {
    for (const hook of this._fileAddHooks) {
      try {
        const r = hook();
        if (r !== undefined) return r;
      } catch (err) {
        this._log.warn('router "onFileAdd" hook threw; skipping it', err);
      }
    }
    return ACTIVITY_TYPES.UPLOAD_LIST;
  }

  /**
   * Navigate to the previous history entry (or close everything if there is
   * none). History stores `[...past, current]`, so the target is the newest
   * entry below the top, skipping entries that are now guarded-out (e.g. an
   * upload list that emptied while a modal was open over it).
   */
  public back(): void {
    for (let i = this._history.length - 2; i >= 0; i--) {
      const prev = this._history[i]!;
      // An earlier entry of the activity already showing is no step back (v1 skipped them too): after "Add more"
      // and an emptied list the history reads start-from, upload-list, start-from.
      if (prev !== this.currentActivity && this._canActivate(prev)) {
        // Truncate to the target (dropping the current entry and any guarded-out entries above it); `_pushHistory`
        // dedupes the re-push.
        this._history.length = i + 1;
        this.navigate(prev);
        return;
      }
    }
    this.navigate(null);
  }

  public destroy(): void {
    this._listeners.clear();
    this._guards.clear();
    this._mountedActivities.clear();
    this._fileAddHooks = [];
  }
}
