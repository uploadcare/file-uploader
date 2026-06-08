import type { ActivityId } from '../activity-ids';
import { type EventBus, UploaderEventType } from '../EventBus';
import { Listeners } from '../host-subscription';

export type EdgeTarget = ActivityId | null;
export type EdgeHandler = (ctx: EdgeContext) => EdgeTarget;
export type Edge = EdgeTarget | EdgeHandler;

/**
 * Hook return sentinel — short-circuits the navigation entirely (no
 * activity change, no modal change). Distinct from `null`, which closes
 * everything, and from `undefined`, which lets the proposed target through.
 */
export const NAVIGATE_CANCEL: unique symbol = Symbol('uc:navigate-cancel');
export type NavigateCancel = typeof NAVIGATE_CANCEL;

export interface ActivityRoute {
  onFileAdd?: Edge;
  onCancel?: Edge;
  onBack?: Edge;
  onDone?: Edge;
  onCapture?: Edge;
  [custom: string]: Edge | undefined;
}

export interface RouteTable {
  _doneActivity?: ActivityId | null;
  activities?: Partial<Record<ActivityId, ActivityRoute>>;
}

export interface EdgeContext {
  edge: string;
  from: ActivityId;
  proposed: EdgeTarget;
  defaults: () => EdgeTarget;
}

type Hook = (ctx: EdgeContext) => EdgeTarget | NavigateCancel | undefined;

/**
 * v2-native router. Tracks two independent activity slots:
 *
 * - `activity`: the *background* activity — what's rendered inline in the
 *   host (minimal's trigger, inline's picker, etc.). v1 calls this
 *   `*currentActivity`.
 * - `modal`: the *foreground* activity — which activity is currently open
 *   in a modal. May be `null` (no modal open) or differ from `activity`
 *   (minimal: background `start-from` trigger + foreground `camera`
 *   modal). v1 keeps these decoupled via `modalManager` + `currentActivity`.
 *
 * `<uc-modal>` opens when `router.modal === modal.id`. ActivityBlocks
 * inside a modal show when `router.modal === activityType`; ones outside
 * a modal show when `router.activity === activityType`.
 */
export class RouterController {
  private _listeners = new Listeners();
  private _table: Required<Pick<RouteTable, 'activities'>> & RouteTable = { activities: {} };
  private _activity: ActivityId | null = null;
  private _modal: ActivityId | null = null;
  private _params: Record<string, unknown> = {};
  private _history: ActivityId[] = [];
  private _hooks = {
    beforeChange: [] as Hook[],
    afterFileAdd: [] as Hook[],
    onCancel: [] as Hook[],
    onClose: [] as Hook[],
    onDone: [] as Hook[],
  };
  private _pluginRoutes: Partial<Record<ActivityId, ActivityRoute>> = {};

  public constructor(private _events: EventBus) {}

  // ─── State (reactive reads) ────────────────────────────────────────────

  public get activity(): ActivityId | null {
    return this._activity;
  }
  public get modal(): ActivityId | null {
    return this._modal;
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

  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  // ─── Route table ───────────────────────────────────────────────────────

  public configure(table: RouteTable): void {
    this._table = { ...table, activities: table.activities ?? {} };
  }

  public addPluginRoutes(activityId: ActivityId, routes: ActivityRoute): void {
    this._pluginRoutes[activityId] = routes;
  }

  private _routeFor(activityId: ActivityId): ActivityRoute | undefined {
    return this._table.activities[activityId] ?? this._pluginRoutes[activityId];
  }

  // ─── Hooks ─────────────────────────────────────────────────────────────

  public readonly hooks = {
    beforeChange: (h: Hook) => this._register('beforeChange', h),
    afterFileAdd: (h: Hook) => this._register('afterFileAdd', h),
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
   * Runs hooks registered under a single edge name (e.g. `afterFileAdd`).
   * The global `beforeChange` hook is NOT run here — it lives in
   * `navigate()` so it fires once per actual navigation regardless of
   * whether the trigger was a direct `navigate()` call or an edge
   * transition.
   */
  private _runEdgeHooks(name: keyof typeof this._hooks, ctx: EdgeContext): EdgeTarget | NavigateCancel {
    for (const hook of this._hooks[name]) {
      const r = hook(ctx);
      if (r === NAVIGATE_CANCEL) return NAVIGATE_CANCEL;
      if (r !== undefined) return r;
    }
    return ctx.proposed;
  }

  // ─── Navigation ────────────────────────────────────────────────────────

  /**
   * Per-preset strategy: given a navigation target, decide whether it
   * goes in the background (`activity`) or foreground (`modal`) slot.
   * Defaults to `'background'` (inline-preset behavior). The Uploader
   * element overrides it in `connectedCallback`:
   *
   * - **Regular**: always `'foreground'` (every screen is a modal).
   * - **Inline**: always `'background'` (no modals at all).
   * - **Minimal**: `'upload-list'` is background (inline list replaces
   *   the trigger); everything else is foreground (modal source pickers
   *   over the persistent trigger).
   *
   * When a `'background'` target is requested while a modal is open,
   * the modal closes — matches v1 minimal's "file-add closes the
   * source-picker and surfaces the inline list" behavior.
   */
  public navigationStrategy: (to: ActivityId) => 'background' | 'foreground' = () => 'background';

  /**
   * Navigates to `to` using the preset-supplied `navigationStrategy`.
   * `navigate(null)` closes everything (modal + activity reset).
   *
   * Every navigation runs through `hooks.beforeChange` first. A hook may
   * return a different `ActivityId` (redirect), `null` (close everything),
   * or `NAVIGATE_CANCEL` (do nothing). Returning `undefined` lets the
   * proposed target through.
   *
   * If you need to bypass the strategy (e.g. preset init), use
   * `setActivity` / `openModal` / `closeModal` directly — those skip the
   * `beforeChange` hook chain.
   */
  public navigate(to: EdgeTarget, params: Record<string, unknown> = {}): void {
    const ctx: EdgeContext = {
      edge: 'navigate',
      from: this._activity ?? ('' as ActivityId),
      proposed: to,
      defaults: () => to,
    };
    let target: EdgeTarget = to;
    for (const hook of this._hooks.beforeChange) {
      const r = hook(ctx);
      if (r === NAVIGATE_CANCEL) return;
      if (r !== undefined) {
        target = r;
        break;
      }
    }
    this._executeNavigate(target, params);
  }

  private _executeNavigate(to: EdgeTarget, params: Record<string, unknown>): void {
    const paramsChanged = !shallowEqual(this._params, params);
    this._params = params;
    if (to === null) {
      this._setModal(null);
      this._setActivity(null);
      return;
    }
    const slot = this.navigationStrategy(to);
    const prevActivity = this._activity;
    const prevModal = this._modal;
    if (slot === 'background') {
      // Close any open modal first — the inline content is the focus now.
      this._setModal(null);
      this._setActivity(to);
    } else {
      this._setModal(to);
    }
    // No activity/modal change but params did — still notify subscribers so
    // `activity.subscribeToParams` callbacks fire on params-only updates.
    if (paramsChanged && prevActivity === this._activity && prevModal === this._modal) {
      this._listeners.notify();
    }
  }

  /**
   * Sets the background activity slot directly, ignoring modal state.
   * Used by preset init (`_initActivity`) and any case where you want
   * to update the inline content without affecting the modal.
   */
  public setActivity(to: EdgeTarget, params: Record<string, unknown> = {}): void {
    this._params = params;
    this._setActivity(to);
  }

  private _setActivity(to: EdgeTarget): void {
    if (to === this._activity) return;
    this._activity = to;
    this._pushHistory(to);
    this._events.emit(UploaderEventType.ACTIVITY_CHANGE, { activity: to });
    this._listeners.notify();
  }

  private _setModal(to: EdgeTarget): void {
    if (to === this._modal) return;
    const wasOpen = this._modal !== null;
    this._modal = to;
    if (to === null && wasOpen) {
      this._events.emit(UploaderEventType.MODAL_CLOSE, {
        activity: null,
        modalId: null,
        hasActiveModals: false,
      });
    } else if (to !== null && !wasOpen) {
      this._events.emit(UploaderEventType.MODAL_OPEN, {
        activity: to,
        modalId: to,
      });
    }
    this._pushHistory(to);
    this._events.emit(UploaderEventType.ACTIVITY_CHANGE, { activity: to });
    this._listeners.notify();
  }

  /**
   * v1-compatible history: each activated activity pushes itself. Going
   * to `null` (closing everything) clears. The check
   * `router.history.length > 0` therefore answers "did the user navigate
   * to *any* activity since the last close" — DynamicBtn uses this to
   * decide whether to suppress the upload-list modal after a file add.
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
   * Opens a modal showing `id` as its foreground activity. Doesn't
   * touch the background `activity` so e.g. the minimal preset's
   * trigger stays visible underneath.
   */
  public openModal(id: ActivityId): void {
    this._setModal(id);
  }

  /**
   * Closes the foreground modal. Doesn't reset the background activity —
   * the inline trigger / inline upload-list keeps its state.
   */
  public closeModal(): void {
    this._setModal(null);
  }

  /**
   * v1-compatible "after file add" routing. Sources, drop zones, paste,
   * and the system dialog all call this after adding a file so consumers
   * (notably DynamicBtn) can override the default navigation via
   * `hooks.afterFileAdd`. Independent of `traverse` because the file may
   * have been added with no current activity (regular preset's
   * `<uc-simple-btn>` triggers a system dialog directly).
   *
   * Default: navigate to `upload-list`. DynamicBtn's hook returns `null`
   * when there's no history (file added straight from the trigger) so
   * the upload-list modal does NOT open — the inline dynamic-button shows
   * the upload status instead.
   */
  public afterFileAdd(): void {
    const ctx: EdgeContext = {
      edge: 'onFileAdd',
      from: this._activity ?? ('' as ActivityId),
      proposed: 'upload-list' as ActivityId,
      defaults: () => 'upload-list' as ActivityId,
    };
    const final = this._runEdgeHooks('afterFileAdd', ctx);
    if (final === NAVIGATE_CANCEL) return;
    this.navigate(final);
  }

  public traverse(edge: string): void {
    if (!this._activity) return;
    const route = this._routeFor(this._activity);
    const proposed = this._resolveEdge(route?.[edge]);
    const ctx: EdgeContext = {
      edge,
      from: this._activity,
      proposed,
      defaults: () => proposed,
    };
    const hookName = this._hookNameForEdge(edge);
    const final = hookName ? this._runEdgeHooks(hookName, ctx) : proposed;
    if (final === NAVIGATE_CANCEL) return;
    this.navigate(final);
  }

  private _resolveEdge(e: Edge | undefined): EdgeTarget {
    if (e === undefined) return null;
    if (typeof e === 'function') {
      return e({
        edge: '',
        from: this._activity ?? ('' as ActivityId),
        proposed: null,
        defaults: () => null,
      });
    }
    return e;
  }

  private _hookNameForEdge(edge: string): keyof typeof this._hooks | null {
    if (edge === 'onFileAdd') return 'afterFileAdd';
    if (edge === 'onCancel') return 'onCancel';
    if (edge === 'onDone') return 'onDone';
    return null;
  }

  /**
   * Pops the current activity off history and navigates to the
   * previous one (or closes everything if history is empty). v1's
   * history stores `[...past, current]`, so we pop twice: once to
   * drop the current entry, then peek the new top.
   */
  public back(): void {
    this._history.pop(); // drop current
    const prev = this._history[this._history.length - 1];
    if (prev) {
      this._history.pop(); // navigate(prev) will push it back
      this.navigate(prev);
    } else {
      this.navigate(null);
    }
  }

  public destroy(): void {
    this._listeners.clear();
    this._hooks = { beforeChange: [], afterFileAdd: [], onCancel: [], onClose: [], onDone: [] };
  }
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (a === b) return true;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}
