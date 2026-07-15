import type { CloudImageEditorState } from '../../blocks/CloudImageEditor/src/state';
import { ALL_TABS, TabId } from '../../blocks/CloudImageEditor/src/toolbar-constants';
import type { Transformations } from '../../blocks/CloudImageEditor/src/types';
import type { ConfigType } from '../../types';
import { StateController } from './StateController';

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
 * Cross-cutting services the editor needs but does not own — injected by the
 * root (from whatever it resolves them from: today's shared uploader ctx,
 * later potentially a fully standalone config/locale). Descendants read them
 * ALL through the controller (`controller.l10n(...)`, `controller.getConfig`,
 * `controller.telemetry`, `controller.proxyUrl`) instead of reaching back
 * into `ChildBlock`/the uploader ctx directly — this is what lets editor
 * blocks be a plain Lit base with no `ensureUploaderCtx`/`UploaderRegistry`
 * value-import (see `EditorBlock` in `editor-context.ts`).
 */
export interface EditorServices {
  l10n: (key: string, variables?: Record<string, string | number>) => string;
  getConfig: <K extends keyof ConfigType>(key: K) => ConfigType[K];
  telemetry: { sendEvent: (e: unknown) => void; sendEventError: (err: unknown, ctx?: unknown) => void };
  proxyUrl: (url: string) => Promise<string>;
}

/** Inert fallback services used until the root injects the real ones (`setServices`) — keeps the controller safely usable standalone (e.g. in unit tests) without throwing. */
function createDefaultServices(): EditorServices {
  return {
    l10n: (key) => key,
    // No real config to read yet — `undefined` as a stand-in until `setServices`
    // injects the real accessor; narrow cast at this one boundary (default-only).
    getConfig: <K extends keyof ConfigType>(_key: K) => undefined as unknown as ConfigType[K],
    telemetry: { sendEvent: () => {}, sendEventError: () => {} },
    proxyUrl: async (url) => url,
  };
}

/**
 * DOM-free editor controller (the `UploaderController`/`ConfigController`
 * pattern — no `lit`, no DOM). Owns the cross-cutting editor state (see
 * `CloudImageEditorControllerState`), the editor's action callbacks, and an
 * injected `EditorServices` seam (l10n/config/telemetry/proxy) so descendants
 * never need to reach back into `ChildBlock`/the uploader ctx directly.
 * Provided down the editor DOM tree via `cloudImageEditorContext`
 * (`@lit/context`) from the root `<uc-cloud-image-editor>`; consumed by
 * `EditorBlock` descendants.
 *
 * Block-coupled DOM-free logic (transformations, tab/filter/operation state
 * machine, image-URL/modifier computation) accretes here as each block ports
 * in P5/P6 (strangler) — kept minimal in this phase (state container only).
 */
export class CloudImageEditorController extends StateController<CloudImageEditorControllerState> {
  private _handlers: Partial<CloudImageEditorHandlers> = {};
  private _services: EditorServices;

  public constructor(initial?: Partial<CloudImageEditorControllerState>, services?: EditorServices) {
    super({ ...createDefaultState(), ...initial });
    this._services = services ?? createDefaultServices();
  }

  /**
   * Inject (or replace) the cross-cutting services. Called by the root once
   * it has resolved the real l10n/config/telemetry/proxy sources. Does not
   * itself notify subscribers — callers that want descendants to re-render
   * on a services swap (e.g. a locale/config change) should follow up with
   * `notify()`.
   *
   * Replaces the whole set (unlike `setHandlers`, which merges) — `EditorServices`
   * is a complete, non-partial interface, so a full object is always required.
   */
  public setServices(services: EditorServices): void {
    this._services = services;
  }

  /** Locale lookup — same contract as `ChildBlock.l10n`/`createL10n` (key fallback, template variables, pluralization upstream). */
  public l10n(key: string, variables?: Record<string, string | number>): string {
    return this._services.l10n(key, variables);
  }

  /** Read a config value from the injected services (today: the shared uploader ctx's config, resolved by the root). */
  public getConfig<K extends keyof ConfigType>(key: K): ConfigType[K] {
    return this._services.getConfig(key);
  }

  /** The injected telemetry sink. */
  public get telemetry(): EditorServices['telemetry'] {
    return this._services.telemetry;
  }

  /** Resolve a CDN url through the configured secure-delivery proxy, if any — delegates to the injected services. */
  public proxyUrl(url: string): Promise<string> {
    return this._services.proxyUrl(url);
  }

  /**
   * `notify()` is inherited from `StateController` — the root calls it after
   * swapping services (`setServices`) or otherwise mutating something
   * descendants read through the controller but that isn't itself a
   * `CloudImageEditorControllerState` key (e.g. a locale dictionary load or a
   * config change upstream). Reuses the same `Listeners` instance as `set()`,
   * so `EditorBlock`'s automatic re-render subscription picks it up for free.
   *
   * Current state snapshot (read-only reference — mutate via `set`). Thin
   * alias over the inherited `values`, kept for the editor's established naming.
   */
  public get state(): Readonly<CloudImageEditorControllerState> {
    return this.values;
  }

  public getState(): Readonly<CloudImageEditorControllerState> {
    return this.values;
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

  public override destroy(): void {
    this._handlers = {};
    super.destroy();
  }
}
