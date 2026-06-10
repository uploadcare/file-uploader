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

  // ─── Hooks ───
  public readonly hooks = {
    beforeChange: (h: Hook) => this._register('beforeChange', h),
    afterFileAdd: (h: Hook) => this._register('afterFileAdd', h),
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
      from: this._activity,
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
    this._params = params;
    if (to === null) {
      this._transition(null, null);
      return;
    }
    // A background target closes any open modal first — the inline content is
    // the focus now; a foreground target leaves the background slot untouched.
    if (this.navigationStrategy(to) === 'background') {
      this._transition(to, null);
    } else {
      this._transition(this._activity, to);
    }
  }

  /** Set the background activity directly (preset init); skips `beforeChange`. */
  public setActivity(to: EdgeTarget, params: Record<string, unknown> = {}): void {
    this._params = params;
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
    this._hooks = { beforeChange: [], afterFileAdd: [] };
  }
}
