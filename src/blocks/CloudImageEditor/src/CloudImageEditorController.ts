import { Signal, signal } from '@lit-labs/signals';
import type { CdnOperation } from '@uploadcare/cdn-url';
import { type ObserveOptions, SignalMap } from '../../../abstract/di/SignalMap';
import type { ConfigType } from '../../../types/index';
import { DEFAULT_CDN_ORIGIN } from '../../../utils/cdn/origin';
import type { EditorL10nKey } from './editor-locale';
import { type ColorPreview, TabId, type TabIdValue } from './toolbar-constants';
import type { CropAspectRatio, Transformations } from './types';

/**
 * Editor-owned config surface — the subset of `ConfigType` the editor cares
 * about. `<uc-cloud-image-editor>`'s `getConfig` service resolves each key from
 * the element's own props, then the uploader-config compat bridge, then
 * `DEFAULT_EDITOR_CONFIG` (see `_setupEditorController`).
 */
export type EditorConfig = Pick<
  ConfigType,
  | 'cdnCname'
  | 'secureDeliveryProxy'
  | 'secureDeliveryProxyUrlResolver'
  | 'cloudImageEditorMaskHref'
  | 'testMode'
  | 'debug'
>;

/** Built-in fallback config — the lowest precedence tier (below own props and the transitional ctx read). */
export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  cdnCname: DEFAULT_CDN_ORIGIN,
  secureDeliveryProxy: '',
  secureDeliveryProxyUrlResolver: null,
  cloudImageEditorMaskHref: null,
  testMode: false,
  debug: false,
};

/**
 * The cross-cutting editor state owned by the controller — keys read/written across more than one component subtree of
 * the editor. The cropper-local (padding/operations/imageBox/cropBox) and
 * toolbar-local (showListAspectRatio/showSlider/currentFilter/currentOperation/
 * operationTooltip) state is deliberately excluded — it is plain Lit `@state`
 * on its owning element, not controller state. So are `cropPresetList`/
 * `tabList`/`imageSize`, which the root passes to `<uc-editor-toolbar>` as
 * plain Lit props (root → single child, no cross-subtree sharing).
 *
 * `colorPreview` is the slider's live, uncommitted color/filter adjustment;
 * the fader reacts to it and renders the preview (see `ColorPreview`). The state
 * holds NO DOM references: the cropper/fader self-activate from
 * `tabId`/`originalUrl`/`colorPreview` + the root's `imageSize` prop, and the
 * toolbar's preload measures the root's image container, passed down as a plain
 * Lit prop.
 */
export type EditorState = {
  originalUrl: string | null;
  loadingImages: number;
  networkProblems: boolean;
  editorTransformations: Transformations;
  /** The full operation list from the incoming URL, unfiltered — edited in place on Apply. */
  sourceOperations: readonly CdnOperation[];
  currentAspectRatio: CropAspectRatio | null;
  tabId: TabIdValue;
  colorPreview: ColorPreview;
};

function createDefaultState(): EditorState {
  return {
    originalUrl: null,
    loadingImages: 0,
    networkProblems: false,
    editorTransformations: {},
    sourceOperations: [],
    currentAspectRatio: null,
    tabId: TabId.CROP,
    colorPreview: null,
  };
}

/**
 * Cross-cutting services the editor needs but does not own — injected by the
 * root (from its own props, falling back to a sibling `<uc-config>`).
 * Descendants read them
 * ALL through the controller (`controller.l10n(...)`, `controller.getConfig`,
 * `controller.telemetry`, `controller.proxyUrl`) instead of reaching back
 * into `ChildBlock`/the uploader ctx directly — this is what lets editor
 * blocks be a plain Lit base with no `ensureUploaderCtx`/`UploaderRegistry`
 * value-import (see `EditorBlock` in `editor-context.ts`).
 */
export interface EditorServices {
  l10n: (key: string, variables?: Record<string, string | number>) => string;
  getConfig: <K extends keyof EditorConfig>(key: K) => EditorConfig[K];
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
    getConfig: (key) => DEFAULT_EDITOR_CONFIG[key],
    telemetry: { sendEvent: () => {}, sendEventError: () => {}, sendActionEvent: () => {} },
    proxyUrl: async (url) => url,
  };
}

/**
 * DOM-free editor controller (the same pattern as `ConfigController` and the
 * other per-ctx controllers — no `lit`, no DOM). Owns the cross-cutting editor
 * state (see `EditorState`) in a composed `SignalMap` and an injected
 * `EditorServices` seam (l10n/config/telemetry/proxy) so descendants never need
 * to reach back into `ChildBlock`/the uploader ctx directly. Action intents
 * (apply/cancel) are NOT stored here — descendants dispatch `uc-internal:*` DOM
 * events that the root (`<uc-cloud-image-editor>`) listens for; the controller
 * holds no callbacks. Provided down the editor DOM tree via
 * `cloudImageEditorContext` (`@lit/context`) from the root
 * `<uc-cloud-image-editor>`; consumed by `EditorBlock` descendants.
 *
 * Each state key is a typed accessor: the getter is a TRACKED read (a
 * `SignalWatcher` render that reads `controller.tabId` re-renders when it
 * changes), the setter dedups with `Object.is`. `observe` runs a side effect on
 * a key's change. `l10n`/`getConfig` read a services revision signal, bumped by
 * `setServices`/`servicesChanged`, so renders that use them re-render on a
 * locale or config change too.
 */
export class CloudImageEditorController {
  readonly #state: SignalMap<EditorState>;
  // Bumped on every services change; read by `l10n`/`getConfig` so a tracked
  // render that uses them re-renders. The value itself means nothing.
  readonly #servicesRevision = signal(0);
  #revision = 0;
  // Every live `observe`r, so `destroy` can release the ones their owners did not.
  readonly #observers = new Set<() => void>();
  #services: EditorServices;

  public constructor(services?: EditorServices) {
    this.#state = new SignalMap<EditorState>(createDefaultState());
    this.#services = services ?? createDefaultServices();
  }

  /**
   * Inject (or replace) the cross-cutting services. Called by the root once
   * it has resolved the real l10n/config/telemetry/proxy sources; renders that
   * read `l10n`/`getConfig` re-render.
   *
   * Replaces the whole set — `EditorServices` is a complete, non-partial
   * interface, so a full object is always required.
   */
  public setServices(services: EditorServices): void {
    this.#services = services;
    this.servicesChanged();
  }

  /**
   * Re-render what reads `l10n`/`getConfig` after a change the services
   * resolve but this controller cannot see — a locale load, an upstream config
   * change, a config prop on the root.
   */
  public servicesChanged(): void {
    this.#servicesRevision.set(++this.#revision);
  }

  /** Locale lookup — same contract as `ChildBlock.l10n`/`createL10n` (key fallback, template variables, pluralization upstream). */
  public l10n(key: EditorL10nKey, variables?: Record<string, string | number>): string {
    this.#servicesRevision.get();
    return this.#services.l10n(key, variables);
  }

  /** Read a config value from the injected services (today: the shared uploader ctx's config, resolved by the root). */
  public getConfig<K extends keyof EditorConfig>(key: K): EditorConfig[K] {
    this.#servicesRevision.get();
    return this.#services.getConfig(key);
  }

  /** The injected telemetry sink. */
  public get telemetry(): EditorServices['telemetry'] {
    return this.#services.telemetry;
  }

  /** Resolve a CDN url through the configured secure-delivery proxy, if any — delegates to the injected services. */
  public proxyUrl(url: string): Promise<string> {
    return this.#services.proxyUrl(url);
  }

  public get originalUrl(): EditorState['originalUrl'] {
    return this.#read('originalUrl');
  }
  public set originalUrl(value: EditorState['originalUrl']) {
    this.#state.set('originalUrl', value);
  }

  public get loadingImages(): EditorState['loadingImages'] {
    return this.#read('loadingImages');
  }
  public set loadingImages(value: EditorState['loadingImages']) {
    this.#state.set('loadingImages', value);
  }

  public get networkProblems(): EditorState['networkProblems'] {
    return this.#read('networkProblems');
  }
  public set networkProblems(value: EditorState['networkProblems']) {
    this.#state.set('networkProblems', value);
  }

  public get editorTransformations(): EditorState['editorTransformations'] {
    return this.#read('editorTransformations');
  }
  public set editorTransformations(value: EditorState['editorTransformations']) {
    this.#state.set('editorTransformations', value);
  }

  public get sourceOperations(): EditorState['sourceOperations'] {
    return this.#read('sourceOperations');
  }
  public set sourceOperations(value: EditorState['sourceOperations']) {
    this.#state.set('sourceOperations', value);
  }

  public get currentAspectRatio(): EditorState['currentAspectRatio'] {
    return this.#read('currentAspectRatio');
  }
  public set currentAspectRatio(value: EditorState['currentAspectRatio']) {
    this.#state.set('currentAspectRatio', value);
  }

  public get tabId(): EditorState['tabId'] {
    return this.#read('tabId');
  }
  public set tabId(value: EditorState['tabId']) {
    this.#state.set('tabId', value);
  }

  public get colorPreview(): EditorState['colorPreview'] {
    return this.#read('colorPreview');
  }
  public set colorPreview(value: EditorState['colorPreview']) {
    this.#state.set('colorPreview', value);
  }

  /**
   * Run `listener` with the new value each time `key` changes (`Object.is`),
   * synchronously from the write; `{ immediate: true }` also runs it once now.
   * The listener runs untracked: it is a side effect, and a write made inside a
   * block's update must not make that block depend on what the listener reads.
   * Returns the unsubscriber; `destroy` releases whatever is still subscribed.
   */
  public observe<K extends keyof EditorState>(
    key: K,
    listener: (value: EditorState[K]) => void,
    options?: ObserveOptions,
  ): () => void {
    const unsubscribe = this.#state.observe(
      key,
      // Every key is seeded in the constructor, so the value is never the absent `undefined`.
      (value) => Signal.subtle.untrack(() => listener(value as EditorState[K])),
      options,
    );
    const dispose = () => {
      unsubscribe();
      this.#observers.delete(dispose);
    };
    this.#observers.add(dispose);
    return dispose;
  }

  /** Release every observer. The state stays: a reconnected root reuses it. */
  public destroy(): void {
    for (const dispose of [...this.#observers]) {
      dispose();
    }
  }

  #read<K extends keyof EditorState>(key: K): EditorState[K] {
    // Seeded for every key in the constructor, so never the absent `undefined`.
    return this.#state.getTracked(key) as EditorState[K];
  }
}

/** Fails to compile when an `EditorState` key has no accessor on the controller, or one of another type. */
type AccessorsCoverState<T extends EditorState> = T;
type _CheckAccessors = AccessorsCoverState<CloudImageEditorController>;
