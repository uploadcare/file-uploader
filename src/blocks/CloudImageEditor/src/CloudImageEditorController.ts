import type { CdnOperation } from '@uploadcare/cdn-url';
import { Listeners } from '../../../abstract/host-subscription';
import type { ConfigType, SecureDeliveryProxyUrlResolver } from '../../../types/index';
import { DEFAULT_CDN_ORIGIN } from '../../../utils/cdn/origin';
import { type ColorPreview, TabId, type TabIdValue } from './toolbar-constants';
import type { CropAspectRatio, Transformations } from './types';

/**
 * Editor-owned config surface — the subset of `ConfigType` the editor cares
 * about. `<uc-cloud-image-editor>`'s `getConfig` service resolves each key from
 * the element's own props, then the uploader-config compat bridge, then
 * `DEFAULT_EDITOR_CONFIG` (see `_setupEditorController`).
 */
export type EditorConfig = {
  cdnCname: string;
  secureDeliveryProxy?: string;
  secureDeliveryProxyUrlResolver?: SecureDeliveryProxyUrlResolver;
  cloudImageEditorMaskHref?: string;
  testMode: boolean;
  debug: boolean;
};

/** Built-in fallback config — the lowest precedence tier (below own props and the transitional ctx read). */
export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  cdnCname: DEFAULT_CDN_ORIGIN,
  secureDeliveryProxy: undefined,
  secureDeliveryProxyUrlResolver: undefined,
  cloudImageEditorMaskHref: undefined,
  testMode: false,
  debug: false,
};

/**
 * The cross-cutting editor state owned by the controller (M12 "State scoping
 * principle") — keys read/written across more than one component subtree of
 * the editor. The cropper-local (`*padding`/`*operations`/`*imageBox`/
 * `*cropBox`) and toolbar-local (`*showListAspectRatio`/`*sliderEl`/
 * `*showSlider`/`*currentFilter`/`*currentOperation`/`*operationTooltip`) keys
 * are deliberately excluded — they are plain Lit `@state` on their owning
 * element, not controller state. So are `cropPresetList`/`tabList`/`imageSize`,
 * which the root now passes to `<uc-editor-toolbar>` as plain Lit props (root →
 * single child, no cross-subtree sharing).
 *
 * `*colorPreview` is the slider's live, uncommitted color/filter adjustment;
 * the fader reacts to it and renders the preview (see `ColorPreview`). The state
 * holds NO DOM references: the cropper/fader self-activate from
 * `*tabId`/`*originalUrl`/`*colorPreview` + the root's `imageSize` prop, and the
 * toolbar's preload measures the root's image container, passed down as a plain
 * Lit prop.
 */
export type CloudImageEditorControllerState = {
  '*originalUrl': string | null;
  '*loadingImages': number;
  '*networkProblems': boolean;
  '*editorTransformations': Transformations;
  /** The full operation list from the incoming URL, unfiltered — edited in place on Apply. */
  '*sourceOperations': readonly CdnOperation[];
  '*currentAspectRatio': CropAspectRatio | null;
  '*tabId': TabIdValue;
  '*colorPreview': ColorPreview;
};

function createDefaultState(): CloudImageEditorControllerState {
  return {
    '*originalUrl': null,
    '*loadingImages': 0,
    '*networkProblems': false,
    '*editorTransformations': {},
    '*sourceOperations': [],
    '*currentAspectRatio': null,
    '*tabId': TabId.CROP,
    '*colorPreview': null,
  };
}

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
  telemetry: {
    sendEvent: (e: unknown) => void;
    sendEventError: (err: unknown, ctx?: unknown) => void;
    /** Same contract as `TelemetryManager.sendActionEvent`. */
    sendActionEvent: (event: string, node: string | undefined, extra?: Record<string, unknown>) => void;
  };
  proxyUrl: (url: string) => Promise<string>;
}

/** Inert fallback services used until the root injects the real ones (`setServices`) — keeps the controller safely usable standalone (e.g. in unit tests) without throwing. */
function createDefaultServices(): EditorServices {
  return {
    l10n: (key) => key,
    // No real config to read yet — `undefined` as a stand-in until `setServices`
    // injects the real accessor; narrow cast at this one boundary (default-only).
    getConfig: <K extends keyof ConfigType>(_key: K) => undefined as unknown as ConfigType[K],
    telemetry: { sendEvent: () => {}, sendEventError: () => {}, sendActionEvent: () => {} },
    proxyUrl: async (url) => url,
  };
}

/**
 * DOM-free editor controller (the same pattern as `ConfigController` and the
 * other per-ctx controllers — no `lit`, no DOM). Owns the cross-cutting editor state (see
 * `CloudImageEditorControllerState`) and an injected `EditorServices` seam
 * (l10n/config/telemetry/proxy) so descendants never need to reach back into
 * `ChildBlock`/the uploader ctx directly. Action intents (apply/cancel) are NOT
 * stored here — descendants dispatch `uc-internal:*` DOM events that the root
 * (`<uc-cloud-image-editor>`) listens for; the controller holds no callbacks.
 * Provided down the editor DOM tree via `cloudImageEditorContext`
 * (`@lit/context`) from the root `<uc-cloud-image-editor>`; consumed by
 * `EditorBlock` descendants.
 */
export class CloudImageEditorController {
  private _state: CloudImageEditorControllerState;
  private _listeners = new Listeners();
  private _services: EditorServices;

  public constructor(initial?: Partial<CloudImageEditorControllerState>, services?: EditorServices) {
    this._state = { ...createDefaultState(), ...initial };
    this._services = services ?? createDefaultServices();
  }

  /**
   * Inject (or replace) the cross-cutting services. Called by the root once
   * it has resolved the real l10n/config/telemetry/proxy sources. Does not
   * itself notify subscribers — callers that want descendants to re-render
   * on a services swap (e.g. a locale/config change) should follow up with
   * `notify()`.
   *
   * Replaces the whole set — `EditorServices` is a complete, non-partial
   * interface, so a full object is always required.
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

  public get<K extends keyof CloudImageEditorControllerState>(key: K): CloudImageEditorControllerState[K] {
    return this._state[key];
  }

  /** Notifies only when the value actually changes (`Object.is` dedup). */
  public set<K extends keyof CloudImageEditorControllerState>(key: K, value: CloudImageEditorControllerState[K]): void {
    if (Object.is(this._state[key], value)) return;
    this._state[key] = value;
    this._listeners.notify();
  }

  /** Coarse subscribe — fires on any state change, not per-key. */
  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  /**
   * Coarse notify with no state change. The root calls it after swapping
   * services (`setServices`) or another change descendants read through the
   * controller that isn't a state key (a locale load, an upstream config
   * change), so `EditorBlock`'s re-render subscription picks it up.
   */
  public notify(): void {
    this._listeners.notify();
  }

  public destroy(): void {
    this._listeners.clear();
  }
}
