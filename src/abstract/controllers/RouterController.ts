import type { ActivityId } from '../../lit/activity-constants';
import { UploaderEventType } from '../EventBus';
import { Listeners } from '../host-subscription';

export type EdgeTarget = ActivityId | null;
export type EdgeHandler = (ctx: EdgeContext) => EdgeTarget;
export type Edge = EdgeTarget | EdgeHandler;

/**
 * Hook return sentinel — short-circuits the navigation entirely (no activity
 * change, no modal change). Distinct from `null` (which closes everything) and
 * `undefined` (which lets the proposed target through).
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
 * Emit the router's documented events. Activity ids are typed as the stable
 * `ActivityId`; the documented `ActivityType` view is bridged where this is
 * wired to the block's telemetry-augmented `emit`.
 */
type RouterEmit = {
  (type: typeof UploaderEventType.ACTIVITY_CHANGE, payload: { activity: ActivityId | null }): void;
  (type: typeof UploaderEventType.MODAL_OPEN, payload: { activity: ActivityId; modalId: ActivityId }): void;
  (
    type: typeof UploaderEventType.MODAL_CLOSE,
    payload: { activity: ActivityId | null; modalId: ActivityId | null; hasActiveModals: boolean },
  ): void;
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

  // ─── Route table ───
  public configure(table: RouteTable): void {
    this._table = { ...table, activities: table.activities ?? {} };
  }

  public addPluginRoutes(activityId: ActivityId, routes: ActivityRoute): void {
    this._pluginRoutes[activityId] = routes;
  }

  private _routeFor(activityId: ActivityId): ActivityRoute | undefined {
    return this._table.activities[activityId] ?? this._pluginRoutes[activityId];
  }

  // ─── Hooks ───
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
   * Runs hooks registered under a single edge name. The global `beforeChange`
   * hook lives in `navigate()` so it fires once per actual navigation.
   */
  private _runEdgeHooks(name: keyof typeof this._hooks, ctx: EdgeContext): EdgeTarget | NavigateCancel {
    for (const hook of this._hooks[name]) {
      const r = hook(ctx);
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
    // No slot change but params did — still notify so params-only updates fire.
    if (paramsChanged && prevActivity === this._activity && prevModal === this._modal) {
      this._listeners.notify();
    }
  }

  /** Set the background activity directly (preset init); skips `beforeChange`. */
  public setActivity(to: EdgeTarget, params: Record<string, unknown> = {}): void {
    this._params = params;
    this._setActivity(to);
  }

  private _setActivity(to: EdgeTarget): void {
    if (to === this._activity) return;
    this._activity = to;
    this._pushHistory(to);
    this._emit(UploaderEventType.ACTIVITY_CHANGE, { activity: to });
    this._listeners.notify();
  }

  private _setModal(to: EdgeTarget): void {
    if (to === this._modal) return;
    const wasOpen = this._modal !== null;
    this._modal = to;
    if (to === null && wasOpen) {
      this._emit(UploaderEventType.MODAL_CLOSE, { activity: null, modalId: null, hasActiveModals: false });
    } else if (to !== null && !wasOpen) {
      this._emit(UploaderEventType.MODAL_OPEN, { activity: to, modalId: to });
    }
    this._pushHistory(to);
    this._emit(UploaderEventType.ACTIVITY_CHANGE, { activity: to });
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
    this._setModal(id);
  }

  /** Close the foreground modal; keeps the background activity. */
  public closeModal(): void {
    this._setModal(null);
  }

  /**
   * v1-compatible "after file add" routing. Default: navigate to `upload-list`;
   * `hooks.afterFileAdd` may override (DynamicBtn returns `null` with no history
   * so the modal stays closed and the inline button shows status).
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

  /** Traverse a named edge of the current activity's route. */
  public traverse(edge: string): void {
    if (!this._activity) return;
    const route = this._routeFor(this._activity);
    const proposed = this._resolveEdge(route?.[edge]);
    const ctx: EdgeContext = { edge, from: this._activity, proposed, defaults: () => proposed };
    const hookName = this._hookNameForEdge(edge);
    const final = hookName ? this._runEdgeHooks(hookName, ctx) : proposed;
    if (final === NAVIGATE_CANCEL) return;
    this.navigate(final);
  }

  private _resolveEdge(e: Edge | undefined): EdgeTarget {
    if (e === undefined) return null;
    if (typeof e === 'function') {
      return e({ edge: '', from: this._activity ?? ('' as ActivityId), proposed: null, defaults: () => null });
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
   * Pop the current activity off history and navigate to the previous one (or
   * close everything if history is empty). History stores `[...past, current]`,
   * so we pop the current entry then peek the new top.
   */
  public back(): void {
    this._history.pop(); // drop current
    const prev = this._history[this._history.length - 1];
    if (prev) {
      this._history.pop(); // navigate(prev) re-pushes it
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
