import type { ActivityId } from '../../lit/activity-constants';
import { UploaderEventType } from '../EventBus';
import { Listeners } from '../host-subscription';

export type EdgeTarget = ActivityId | null;

/**
 * Hook return sentinel — short-circuits the navigation entirely (no activity
 * change, no modal change). Distinct from `null` (which closes everything) and
 * `undefined` (which lets the proposed target through).
 */
export const NAVIGATE_CANCEL: unique symbol = Symbol('uc:navigate-cancel');
export type NavigateCancel = typeof NAVIGATE_CANCEL;

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
 * Emit the router's documented events with their exact documented payloads
 * (see `UploaderEventPayload` in `EventBus`). Activity ids are typed as the
 * strict `ActivityId`; the documented `ActivityType` view is bridged where this
 * is wired to the block's telemetry-augmented `emit`.
 */
type RouterEmit = {
  (type: typeof UploaderEventType.ACTIVITY_CHANGE, payload: { activity: ActivityId | null }): void;
  (type: typeof UploaderEventType.MODAL_OPEN, payload: { modalId: ActivityId }): void;
  (type: typeof UploaderEventType.MODAL_CLOSE, payload: { modalId: ActivityId; hasActiveModals: boolean }): void;
};

export type RouterControllerDeps = {
  emit: RouterEmit;
};

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
  private _emit: RouterEmit;
  private _listeners = new Listeners();
  private _table: RouteTable = {};
  private _activity: ActivityId | null = null;
  private _modal: ActivityId | null = null;
  private _params: Record<string, unknown> = {};
  private _history: ActivityId[] = [];
  private _hooks = {
    beforeChange: [] as Hook[],
    afterFileAdd: [] as Hook[],
    onBack: [] as Hook[],
    onCancel: [] as Hook[],
    onClose: [] as Hook[],
    onDone: [] as Hook[],
  };

  public constructor(deps: RouterControllerDeps) {
    this._emit = deps.emit;
  }

  // ─── State (reactive reads) ───
  public get activity(): ActivityId | null {
    return this._activity;
  }
  public get modal(): ActivityId | null {
    return this._modal;
  }
  /**
   * The single "effective" activity — the foreground modal if one is open,
   * otherwise the background activity. This is the v1 `*currentActivity`
   * semantics: what the activity FSM activates on and what most readers want.
   */
  public get currentActivity(): ActivityId | null {
    return this._modal ?? this._activity;
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
      console.warn(`[uc] router guard for "${id}" threw; treating the activity as not activatable`, err);
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

  // ─── Hooks ───
  /**
   * Register interceptors for navigation intents. A hook may redirect (return
   * an activity id), close everything (`null`), cancel the intent
   * (`NAVIGATE_CANCEL`), or defer to the default (`undefined`). The edge hooks
   * (`onBack`/`onCancel`/`onClose`/`onDone`) fire from {@link traverse}.
   */
  public readonly hooks = {
    beforeChange: (h: Hook) => this._register('beforeChange', h),
    afterFileAdd: (h: Hook) => this._register('afterFileAdd', h),
    onBack: (h: Hook) => this._register('onBack', h),
    onCancel: (h: Hook) => this._register('onCancel', h),
    onClose: (h: Hook) => this._register('onClose', h),
    onDone: (h: Hook) => this._register('onDone', h),
  };

  private _register(name: keyof typeof this._hooks, h: Hook): () => void {
    this._hooks[name].push(h);
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
      console.warn(`[uc] router "${name}" hook threw; skipping it`, err);
      return undefined;
    }
  }

  /**
   * Runs hooks registered under a single edge name. The global `beforeChange`
   * hook lives in `navigate()` so it fires once per actual navigation.
   */
  private _runEdgeHooks(name: keyof typeof this._hooks, ctx: EdgeContext): EdgeTarget | NavigateCancel {
    for (const hook of this._hooks[name]) {
      const r = this._invokeHook(name, hook, ctx);
      if (r === NAVIGATE_CANCEL) return NAVIGATE_CANCEL;
      if (r !== undefined) return r;
    }
    return ctx.proposed;
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
    // `from` is the *effective* current activity (modal if open, else the
    // background slot), matching `traverse()` so `beforeChange` hooks always
    // observe the same "current activity" regardless of which slot it's in.
    const ctx: EdgeContext = { edge: 'navigate', from: this.currentActivity, proposed: to, defaults: () => to };
    const target = this._runEdgeHooks('beforeChange', ctx);
    if (target === NAVIGATE_CANCEL) {
      return;
    }
    this._executeNavigate(target, params);
  }

  private _executeNavigate(to: EdgeTarget, params: Record<string, unknown>): void {
    if (to === null) {
      this._params = params;
      this._transition(null, null);
      return;
    }
    // A guarded-out activity can't be entered (e.g. an empty upload list);
    // refuse the navigation and stay where we are — leaving `_params` untouched
    // so readers never observe params for an activity we didn't actually enter.
    if (!this._canActivate(to)) {
      return;
    }
    this._params = params;
    // A background target closes any open modal first — the inline content is
    // the focus now; a foreground target leaves the background slot untouched.
    if (this.navigationStrategy(to) === 'background') {
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
    const prevModal = this._modal;
    const prevEffective = this.currentActivity;
    this._activity = nextActivity;
    this._modal = nextModal;
    const nextEffective = this.currentActivity;

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
   * - `onDone` → navigate to the configured {@link doneActivity}.
   */
  public traverse(edge: 'onBack' | 'onCancel' | 'onClose' | 'onDone'): void {
    // `proposed`/`defaults()` carry a concrete target only for `onDone` (the
    // done activity). For `onBack`/`onCancel`/`onClose` the default is an
    // *action* (`back()`/`close()`), not a target, so `proposed` is `null`.
    const proposed = edge === 'onDone' ? this.doneActivity : null;
    const ctx: EdgeContext = { edge, from: this.currentActivity, proposed, defaults: () => proposed };
    for (const hook of this._hooks[edge]) {
      const r = this._invokeHook(edge, hook, ctx);
      if (r === NAVIGATE_CANCEL) return;
      if (r !== undefined) {
        this.navigate(r);
        return;
      }
    }
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
    }
  }

  /**
   * v1-compatible "after file add" routing. Default: navigate to `upload-list`;
   * `hooks.afterFileAdd` may override (DynamicBtn returns `null` with no history
   * so the modal stays closed and the inline button shows status).
   */
  public afterFileAdd(): void {
    const ctx: EdgeContext = {
      edge: 'onFileAdd',
      from: this._activity,
      proposed: 'upload-list',
      defaults: () => 'upload-list',
    };
    const final = this._runEdgeHooks('afterFileAdd', ctx);
    if (final === NAVIGATE_CANCEL) return;
    this.navigate(final);
  }

  /**
   * Pop the current activity off history and navigate to the previous one (or
   * close everything if history is empty). History stores `[...past, current]`,
   * so we pop the current entry then peek the new top.
   *
   * Skips previous entries that are now guarded-out (e.g. an upload list that
   * emptied while a modal was open over it) rather than popping one blindly —
   * `navigate` would refuse a guarded-out target without re-pushing it, which
   * would leave history inconsistent with the visible activity.
   */
  public back(): void {
    this._history.pop(); // drop current
    while (this._history.length > 0) {
      const prev = this._history[this._history.length - 1]!;
      if (this._canActivate(prev)) {
        this._history.pop(); // navigate(prev) re-pushes it
        this.navigate(prev);
        return;
      }
      this._history.pop(); // guarded-out now — drop it and keep looking back
    }
    this.navigate(null);
  }

  public destroy(): void {
    this._listeners.clear();
    this._hooks = { beforeChange: [], afterFileAdd: [], onBack: [], onCancel: [], onClose: [], onDone: [] };
  }
}
