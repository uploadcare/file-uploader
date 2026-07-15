import type { CloudImageEditorState } from '../../blocks/CloudImageEditor/src/state';
import { ALL_TABS, TabId } from '../../blocks/CloudImageEditor/src/toolbar-constants';
import type { Transformations } from '../../blocks/CloudImageEditor/src/types';
import { Listeners } from '../host-subscription';

/**
 * The cross-cutting subset of `CloudImageEditorState` (M12 "State scoping
 * principle") — keys read/written across more than one component subtree of
 * the editor. The cropper-local (`*padding`/`*operations`/`*imageBox`/
 * `*cropBox`) and toolbar-local (`*showListAspectRatio`/`*sliderEl`/
 * `*showSlider`/`*currentFilter`/`*currentOperation`/`*operationTooltip`) keys
 * are deliberately excluded — they become plain Lit `@state` on their owning
 * element when that subtree ports (P6), not controller state.
 *
 * `*faderEl`/`*cropperEl`/`*imgContainerEl` are cross-component coordination
 * refs (a smell, flagged in the plan for a later refinement to controller
 * methods) — the controller only stores/returns them, it never touches the
 * DOM itself.
 */
export type CloudImageEditorControllerState = Pick<
  CloudImageEditorState,
  | '*originalUrl'
  | '*loadingOperations'
  | '*networkProblems'
  | '*imageSize'
  | '*editorTransformations'
  | '*cropPresetList'
  | '*currentAspectRatio'
  | '*tabList'
  | '*tabId'
  | '*faderEl'
  | '*cropperEl'
  | '*imgContainerEl'
>;

function createDefaultState(): CloudImageEditorControllerState {
  return {
    '*originalUrl': null,
    '*loadingOperations': new Map(),
    '*networkProblems': false,
    '*imageSize': null,
    '*editorTransformations': {},
    '*cropPresetList': [],
    '*currentAspectRatio': null,
    '*tabList': ALL_TABS,
    '*tabId': TabId.CROP,
    '*faderEl': null,
    '*cropperEl': null,
    '*imgContainerEl': null,
  };
}

/** The editor's action callbacks — set by the root, invoked by descendants via the controller's methods. Not state: overwriting a handler does not notify subscribers. */
export type CloudImageEditorHandlers = {
  onApply: (transformations: Transformations) => void;
  onCancel: () => void;
  onRetryNetwork: () => void;
};

/**
 * DOM-free editor controller (the `UploaderController`/`ConfigController`
 * pattern — no `lit`, no DOM). Owns ONLY the cross-cutting editor state (see
 * `CloudImageEditorControllerState`) plus the editor's action callbacks.
 * Provided down the editor DOM tree via `cloudImageEditorContext`
 * (`@lit/context`) from the root `<uc-cloud-image-editor>`; consumed by
 * `EditorChildBlock` descendants.
 *
 * Block-coupled DOM-free logic (transformations, tab/filter/operation state
 * machine, image-URL/modifier computation) accretes here as each block ports
 * in P5/P6 (strangler) — kept minimal in this phase (state container only).
 */
export class CloudImageEditorController {
  private _state: CloudImageEditorControllerState;
  private _listeners = new Listeners();
  private _handlers: Partial<CloudImageEditorHandlers> = {};

  public constructor(initial?: Partial<CloudImageEditorControllerState>) {
    this._state = { ...createDefaultState(), ...initial };
  }

  /** Current state snapshot (read-only reference — mutate via `set`). */
  public get state(): Readonly<CloudImageEditorControllerState> {
    return this._state;
  }

  public getState(): Readonly<CloudImageEditorControllerState> {
    return this._state;
  }

  public get<K extends keyof CloudImageEditorControllerState>(key: K): CloudImageEditorControllerState[K] {
    return this._state[key];
  }

  /** Notifies only when the value actually changes (`Object.is` dedup), same contract as `ConfigController.set`. */
  public set<K extends keyof CloudImageEditorControllerState>(key: K, value: CloudImageEditorControllerState[K]): void {
    if (Object.is(this._state[key], value)) return;
    this._state[key] = value;
    this._listeners.notify();
  }

  /** Coarse subscribe — fires on any state change, not per-key (mirrors `ConfigController.subscribe`). */
  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  /**
   * Set (or replace) the editor's action handlers. Called by the root once it
   * has resolved the actual apply/cancel/retryNetwork behavior. Handlers are
   * plain callbacks, not state — setting them does not notify subscribers.
   */
  public setHandlers(handlers: Partial<CloudImageEditorHandlers>): void {
    this._handlers = { ...this._handlers, ...handlers };
  }

  public apply(transformations: Transformations): void {
    this._handlers.onApply?.(transformations);
  }

  public cancel(): void {
    this._handlers.onCancel?.();
  }

  public retryNetwork(): void {
    this._handlers.onRetryNetwork?.();
  }

  public destroy(): void {
    this._listeners.clear();
    this._handlers = {};
  }
}
