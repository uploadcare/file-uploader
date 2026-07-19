import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import type { ActivityId } from '../../lit/activity-constants';
import { controllerLogger } from '../controllerLogger';
import { inject } from '../di/inject';
import { signalState } from '../di/signalState';
import { type UploaderEventKey, type UploaderEventPayload, UploaderEventType } from '../EventBus';
import { Listeners } from '../host-subscription';

export type EdgeTarget = ActivityId | null;

/**
 * Hook return sentinel — short-circuits the navigation entirely (no activity
 * change, no modal change). Distinct from `null` (which closes everything) and
 * `undefined` (which lets the proposed target through).
 */
export const NAVIGATE_CANCEL: unique symbol = Symbol('uc:navigate-cancel');
export type NavigateCancel = typeof NAVIGATE_CANCEL;

/** The navigation intents resolvable via {@link RouterController.traverse}. */
export type NavigationEdge = 'onBack' | 'onCancel' | 'onClose' | 'onDone' | 'onFileAdd';

/** Per-preset routing config, set by the solution via {@link RouterController.configure}. */
export interface RouteTable {
  /** Activity to land on after a completed flow (preset-specific). */
  doneActivity?: ActivityId | null;
}

export interface EdgeContext {
  edge: string;
  /** The current activity when the edge fires, or `null` when nothing is open. */
  from: ActivityId | null;
  proposed: EdgeTarget;
  defaults: () => EdgeTarget;
}

type Hook = (ctx: EdgeContext) => EdgeTarget | NavigateCancel | undefined;

/**
 * v2-native dual-slot router. Tracks two independent activity slots:
 *
 * - `activity` (background): what's rendered inline in the host (minimal's
 *   trigger, inline's picker). v1 calls this `*currentActivity`.
 * - `modal` (foreground): which activity is open in a modal. May be `null` or
 *   differ from `activity` (minimal: background `start-from` trigger +
 *   foreground `camera` modal). v1 keeps these decoupled via `modalManager`.
 *
 * `<uc-modal>` opens when `router.modal === its id`. Replaces v1's
 * `LitActivityBlock` FSM + `ModalManager` + `RouterHooksLayer` +
 * `*currentActivity`. DOM-free + unit-testable: collaborators are injected and
 * the only side effect is the injected `emit`.
 */
export class RouterController {
  // Per-ctx logger: `warn`/`error` always print, prefixed with THIS ctx's name
  // (resolved lazily at log time via the container that built this instance).
  private readonly _log = controllerLogger(this, 'router');
  // Container-resolved emit target (M-god step 3c). Thunked `@inject` because
  // the module graph around the event surface is circular-prone; resolution is
  // lazy so there is zero construction cycle. Telemetry observes the bus, so
  // there is NO telemetry mirror here — `_emit` is pure dispatch + debounce.
  @inject(() => EventEmitter) private readonly _eventEmitter!: EventEmitter;
  private _listeners = new Listeners();
  private _table: RouteTable = {};
  private _activity: ActivityId | null = null;
  // Backed by `@signalState` so a `SignalWatcher` consumer can track the
  // foreground modal slot directly (M-god step 6b-3: `<uc-modal>` reads
  // `router.modal` in `willUpdate` to drive its `<dialog>` open/close). This is
  // distinct from `_currentActivity` (`_modal ?? _activity`): a modal opening on
  // the id that's already the background activity leaves the effective activity
  // unchanged, so only the modal-slot signal captures that transition. The
  // coarse `_listeners.notify()` every existing reader relies on is unchanged.
  @signalState() private _modal: ActivityId | null = null;
  // The single "effective" activity as a signal-backed field (M-god step 3c) —
  // kept in lockstep with the two slots by `_transition` (its sole writer, via
  // the two slots' sole writer). Backed by `@signalState` so a future
  // `SignalWatcher` consumer can track it; the coarse `_listeners.notify()`
  // change-notification every current reader relies on is preserved unchanged.
  @signalState() private _currentActivity: ActivityId | null = null;
  private _params: Record<string, unknown> = {};
  private _history: ActivityId[] = [];
  private _hooks = {
    beforeChange: [] as Hook[],
    onFileAdd: [] as Hook[],
    onBack: [] as Hook[],
    onCancel: [] as Hook[],
    onClose: [] as Hook[],
    onDone: [] as Hook[],
  };

  // Zero-arg constructor: the container builds this with `new RouterController()`
  // and the emit target resolves lazily through `@inject`.

  /**
   * Emit a router event to the container-owned {@link EventEmitter}, debouncing
   * modal transitions (matches v1 `LitBlock._routerEmit`: modal open/close
   * debounce, activity-change fires immediately). This is the debounce that
   * used to live in `UploaderController`'s router-emit closure (M-god step 3c);
   * telemetry sees the already-debounced bus event since it observes the bus.
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
   * otherwise the background activity. This is the v1 `*currentActivity`
   * semantics: what the activity FSM activates on and what most readers want.
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

  /** Per-preset routing config (solution-level), e.g. the post-flow done activity. */
  public configure(table: RouteTable): void {
    this._table = { ...table };
    this._log.debug(() => [`configure: done activity = ${this._table.doneActivity ?? 'none'}`]);
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
    this._log.debug(() => [`guard registered: "${activityId}"`]);
    return () => {
      if (this._guards.get(activityId) === canActivate) {
        this._guards.delete(activityId);
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

  // Mounted-activity signal: ported activity blocks (ActivityChildBlock)
  // report themselves here on adoption/release, replacing their former
  // membership in the v1 `*blocksRegistry` for "is this activity's block
  // mounted?" waits. Refcounted — the same activityType can be mounted in
  // several slots at once (e.g. minimal's two <uc-start-from>).
  private _mountedActivities = new Map<ActivityId, number>();

  /** Report a mounted activity block. Returns the matching un-mount call. */
  public activityBlockMounted(activityType: ActivityId): () => void {
    this._mountedActivities.set(activityType, (this._mountedActivities.get(activityType) ?? 0) + 1);
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
  /**
   * Register interceptors for navigation intents. A hook may redirect (return
   * an activity id), close everything (`null`), cancel the intent
   * (`NAVIGATE_CANCEL`), or defer to the default (`undefined`). The edge hooks
   * (`onFileAdd`/`onBack`/`onCancel`/`onClose`/`onDone`) fire from
   * {@link traverse}; `beforeChange` fires from `navigate()` itself, once per
   * actual navigation.
   */
  public readonly hooks = {
    beforeChange: (h: Hook) => this._register('beforeChange', h),
    onFileAdd: (h: Hook) => this._register('onFileAdd', h),
    onBack: (h: Hook) => this._register('onBack', h),
    onCancel: (h: Hook) => this._register('onCancel', h),
    onClose: (h: Hook) => this._register('onClose', h),
    onDone: (h: Hook) => this._register('onDone', h),
  };

  private _register(name: keyof typeof this._hooks, h: Hook): () => void {
    this._hooks[name].push(h);
    this._log.debug(() => [`hook registered: "${name}" (${this._hooks[name].length} total)`]);
    return () => {
      this._hooks[name] = this._hooks[name].filter((x) => x !== h);
    };
  }

  /**
   * Invoke a single hook, isolating a throw (AGENTS.md #3): a broken hook must
   * not abort the navigation or the rest of the chain. A throw is warned and
   * treated as `undefined` (defer to the next hook / the default).
   */
  private _invokeHook(name: string, hook: Hook, ctx: EdgeContext): EdgeTarget | NavigateCancel | undefined {
    try {
      return hook(ctx);
    } catch (err) {
      this._log.warn(`router "${name}" hook threw; skipping it`, err);
      return undefined;
    }
  }

  /**
   * Runs the hooks registered under a single edge name until one decides:
   * a target (or `null`), or `NAVIGATE_CANCEL`. Returns `undefined` when
   * every hook defers — what that means is the *caller's* call: `navigate()`
   * proceeds to the proposed target, `traverse()` runs the edge's default
   * action (`back()`/`close()`/…), which is why the fall-through can't be
   * resolved here.
   */
  private _resolveHooks(name: keyof typeof this._hooks, ctx: EdgeContext): EdgeTarget | NavigateCancel | undefined {
    for (const hook of this._hooks[name]) {
      const r = this._invokeHook(name, hook, ctx);
      this._log.debug(() => [
        `hook "${name}" → ${
          r === NAVIGATE_CANCEL ? 'cancel' : r === undefined ? 'defer' : r === null ? 'close (null)' : `"${r}"`
        }`,
      ]);
      if (r !== undefined) return r;
    }
    return undefined;
  }

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
   * closes everything. Runs `hooks.beforeChange` first — a hook may redirect
   * (return an id), close everything (`null`), or cancel (`NAVIGATE_CANCEL`);
   * `undefined` lets the proposed target through.
   */
  public navigate(to: EdgeTarget, params: Record<string, unknown> = {}): void {
    this._navigate(to, params);
  }

  /**
   * `navigate` with an optional commit callback: `onCommit` runs only once the
   * navigation is definitely happening (hooks didn't cancel, guards didn't
   * refuse), just before the transition, and receives the *resolved* target —
   * which may differ from the proposed one when a hook redirected. `back()`
   * uses it to mutate history at the commit point instead of up front, so
   * `beforeChange` hooks observe the un-mutated history and a cancel costs
   * nothing.
   */
  private _navigate(to: EdgeTarget, params: Record<string, unknown>, onCommit?: (resolved: EdgeTarget) => void): void {
    // `from` is the *effective* current activity (modal if open, else the
    // background slot), matching `traverse()` so `beforeChange` hooks always
    // observe the same "current activity" regardless of which slot it's in.
    const ctx: EdgeContext = { edge: 'navigate', from: this.currentActivity, proposed: to, defaults: () => to };
    const resolved = this._resolveHooks('beforeChange', ctx);
    if (resolved === NAVIGATE_CANCEL) {
      this._log.debug(() => [`navigate to ${to ?? 'null'} cancelled by a beforeChange hook`]);
      return;
    }
    if (resolved !== undefined && resolved !== to) {
      this._log.debug(() => [`beforeChange hook redirected: ${to ?? 'null'} → ${resolved ?? 'null'}`]);
    }
    // All hooks deferred (`undefined`) → the proposed target goes through.
    // Note `null` is a real decision (close everything), so no `??` here.
    this._executeNavigate(resolved === undefined ? to : resolved, params, onCommit);
  }

  private _executeNavigate(
    to: EdgeTarget,
    params: Record<string, unknown>,
    onCommit?: (resolved: EdgeTarget) => void,
  ): void {
    if (to === null) {
      this._params = params;
      onCommit?.(null);
      this._transition(null, null);
      return;
    }
    // A guarded-out activity can't be entered (e.g. an empty upload list);
    // refuse the navigation and stay where we are — leaving `_params` untouched
    // so readers never observe params for an activity we didn't actually enter.
    if (!this._canActivate(to)) {
      this._log.debug(() => [`navigate to "${to}" refused (guard)`]);
      return;
    }
    this._params = params;
    onCommit?.(to);
    // A background target closes any open modal first — the inline content is
    // the focus now; a foreground target leaves the background slot untouched.
    const slot = this.navigationStrategy(to);
    this._log.debug(() => [`strategy for "${to}": ${slot}`]);
    if (slot === 'background') {
      this._transition(to, null);
    } else {
      this._transition(this._activity, to);
    }
  }

  /**
   * Set the background activity directly (preset init); skips `beforeChange`.
   * `params` is optional — omit it to change only the background slot without
   * clobbering the current activity's params (e.g. a preset reacting to the
   * upload list while a modal is open in the foreground slot).
   */
  public setActivity(to: EdgeTarget, params?: Record<string, unknown>): void {
    this._log.debug(() => [`set activity (direct): ${to ?? 'null'}`]);
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
   * - `MODAL_OPEN` when the modal slot goes closed → open,
   * - `MODAL_CLOSE` (carrying the id that closed) when it goes open → closed,
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
      this._log.debug(() => [`background activity: ${prevActivity ?? 'none'} → ${nextActivity ?? 'none'}`]);
    }
    if (nextModal !== prevModal) {
      this._log.debug(() => [`modal activity: ${prevModal ?? 'none'} → ${nextModal ?? 'none'}`]);
    }

    if (prevModal === null && nextModal !== null) {
      this._emit(UploaderEventType.MODAL_OPEN, { modalId: nextModal });
    } else if (prevModal !== null && nextModal === null) {
      this._emit(UploaderEventType.MODAL_CLOSE, { modalId: prevModal, hasActiveModals: false });
    }

    if (nextEffective !== prevEffective) {
      this._pushHistory(nextEffective);
      this._emit(UploaderEventType.ACTIVITY_CHANGE, { activity: nextEffective });
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

  /** Open a modal for `id` without touching the background activity. */
  public openModal(id: ActivityId): void {
    if (!this._canActivate(id)) {
      return;
    }
    this._transition(this._activity, id);
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
   * directly. A registered edge hook may intercept (redirect / `null` / cancel);
   * otherwise the built-in default applies:
   * - `onBack` / `onCancel` → {@link back},
   * - `onClose` → {@link close},
   * - `onDone` → navigate to the configured {@link doneActivity},
   * - `onFileAdd` → navigate to `upload-list`.
   */
  public traverse(edge: NavigationEdge): void {
    this._log.debug(() => [`traverse "${edge}"`]);
    // `proposed`/`defaults()` carry a concrete target only when the default
    // *is* a target (`onDone` → done activity, `onFileAdd` → upload-list).
    // For `onBack`/`onCancel`/`onClose` the default is an *action*
    // (`back()`/`close()`), not a target, so `proposed` is `null`.
    const proposed = edge === 'onDone' ? this.doneActivity : edge === 'onFileAdd' ? 'upload-list' : null;
    // `from` is the effective (modal-aware) activity — `EdgeContext.from`
    // always means "what the user currently sees".
    const ctx: EdgeContext = { edge, from: this.currentActivity, proposed, defaults: () => proposed };
    const resolved = this._resolveHooks(edge, ctx);
    if (resolved === NAVIGATE_CANCEL) return;
    if (resolved !== undefined) {
      this.navigate(resolved);
      return;
    }
    // All hooks deferred → the edge's default *action* applies.
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
        this.navigate('upload-list');
        break;
    }
  }

  /**
   * Navigate to the previous history entry (or close everything if there is
   * none). History stores `[...past, current]`, so the target is the newest
   * entry below the top, skipping entries that are now guarded-out (e.g. an
   * upload list that emptied while a modal was open over it).
   *
   * History is only *peeked* here — it mutates at the commit point, after the
   * `beforeChange` hooks have had their say. A hook that cancels (or a guard
   * that refuses a redirect target) leaves history exactly as it was; a hook
   * that redirects still drops the entry being left before the redirect target
   * is pushed.
   */
  public back(): void {
    for (let i = this._history.length - 2; i >= 0; i--) {
      const prev = this._history[i]!;
      if (this._canActivate(prev)) {
        // Commit: truncate to the target (dropping the current entry and any
        // guarded-out entries above it); `_pushHistory` dedupes the re-push.
        // When a hook redirected to the activity we're already on, the
        // effective activity won't change, so `_transition` would never
        // re-push it — keep history intact instead of dropping the top.
        this._navigate(prev, {}, (resolved) => {
          if (resolved !== this.currentActivity) {
            this._history.length = i + 1;
          }
        });
        return;
      }
    }
    this.navigate(null);
  }

  public destroy(): void {
    this._listeners.clear();
    this._guards.clear();
    this._mountedActivities.clear();
    this._hooks = { beforeChange: [], onFileAdd: [], onBack: [], onCancel: [], onClose: [], onDone: [] };
  }
}
