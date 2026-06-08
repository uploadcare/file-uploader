import { CROP_PADDING } from '../../blocks/CloudImageEditor/src/cropper-constants';
import { ALL_TABS, TabId } from '../../blocks/CloudImageEditor/src/toolbar-constants';
import type {
  CropAspectRatio,
  ImageSize,
  LoadingOperations,
  Rectangle,
  Transformations,
} from '../../blocks/CloudImageEditor/src/types';

type TabIdValue = (typeof TabId)[keyof typeof TabId];

type CropOperations = {
  rotate: number;
  mirror: boolean;
  flip: boolean;
};

/**
 * Typed state shape for the v2 cloud-image-editor. Mirrors the v1 keys
 * one-for-one so the existing sub-component logic (cropper math, fader
 * animation, toolbar tabs, slider tooltip, etc.) keeps the same data
 * contract — only the access surface changes from `this.$['*key']` to
 * `this.editor.get('*key')`.
 */
export type EditorState = {
  '*originalUrl': string | null;
  '*loadingOperations': LoadingOperations;
  '*faderEl': HTMLElement | null;
  '*cropperEl': HTMLElement | null;
  '*sliderEl': HTMLElement | null;
  '*imgEl': HTMLImageElement | null;
  '*imgContainerEl': HTMLDivElement | null;
  '*networkProblems': boolean;
  '*imageSize': ImageSize | null;
  '*editorTransformations': Transformations;
  '*cropPresetList': CropAspectRatio[];
  '*currentAspectRatio': CropAspectRatio | null;
  '*tabList': readonly TabIdValue[];
  '*tabId': TabIdValue;
  '*showSlider': boolean;
  '*showListAspectRatio': boolean;
  '*currentFilter': string;
  '*currentOperation': string | null;
  '*operationTooltip': string | null;
  '*padding': number;
  '*operations': CropOperations;
  '*imageBox': Rectangle;
  '*cropBox': Rectangle;
  '*on.apply': (transformations: Transformations) => void;
  '*on.cancel': () => void;
  '*on.retryNetwork': () => void;
  /** SVG `href` for the crop mask — defaults to null; the outer editor
   * block mirrors `config.cloudImageEditorMaskHref` here when present. */
  '*maskHref': string | null;
  /** True when the surrounding `<uc-config>` / `<uc-uploader>` has
   * `testMode` on, or when the outer block carries `test-mode` itself.
   * Every `EditorBlock` reflects its tag as `data-testid` while true. */
  '*testMode': boolean;
};

type Listener = () => void;

/**
 * Per-editor-instance reactive state. Replaces v1's `SymbioteMixin` /
 * `PubSub`-by-`ctx-name` global registry with a plain object store +
 * per-key listener sets. Sub-components reach the controller via a Lit
 * context provided by `<uc-cloud-image-editor>` — there's no global
 * lookup, no `ctx-name` routing, no nanostores.
 *
 * Notifications are coalesced per-key and delivered in a microtask, so
 * a writer can `set('*originalUrl', …); set('*imageSize', …)` and
 * subscribers see both updates after the current task drains — same
 * timing v1's nanostores `MapStore.listenKeys` provided. Multiple
 * back-to-back writes to the same key collapse to a single notify.
 */
export class EditorStateController {
  private _state: EditorState;
  private _keyListeners = new Map<keyof EditorState, Set<Listener>>();
  private _pendingKeys = new Set<keyof EditorState>();
  private _flushScheduled = false;

  public constructor(initial: EditorState) {
    this._state = { ...initial };
  }

  public get<K extends keyof EditorState>(key: K): EditorState[K] {
    return this._state[key];
  }

  public set<K extends keyof EditorState>(key: K, value: EditorState[K]): void {
    if (this._state[key] === value) return;
    this._state[key] = value;
    this._scheduleNotify(key);
  }

  /**
   * Force a notification even when the value is reference-equal. Some v1
   * call sites mutate a Map / array in place and then re-assign the same
   * reference to signal "contents changed" — those paths need an
   * explicit re-fire.
   */
  public touch<K extends keyof EditorState>(key: K): void {
    this._scheduleNotify(key);
  }

  /** Subscribe to a single key. Returns an unsubscribe function. */
  public subscribe<K extends keyof EditorState>(key: K, listener: Listener): () => void {
    let set = this._keyListeners.get(key);
    if (!set) {
      set = new Set();
      this._keyListeners.set(key, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  private _scheduleNotify<K extends keyof EditorState>(key: K): void {
    this._pendingKeys.add(key);
    if (this._flushScheduled) return;
    this._flushScheduled = true;
    queueMicrotask(() => this._flush());
  }

  private _flush(): void {
    this._flushScheduled = false;
    const pending = Array.from(this._pendingKeys);
    this._pendingKeys.clear();
    for (const key of pending) {
      const set = this._keyListeners.get(key);
      if (!set) continue;
      for (const listener of set) {
        try {
          listener();
        } catch (err) {
          console.warn(`[v2/cie] listener for "${String(key)}" threw`, err);
        }
      }
    }
  }
}

/**
 * Build the initial editor state. Mirrors v1's `initState()` from
 * `src/blocks/CloudImageEditor/src/state.ts` plus the keys that
 * `EditorToolbar.init$` and `EditorImageCropper`'s constructor used to
 * contribute through `LitBlock.init$` chaining.
 */
export function createInitialEditorState(callbacks: {
  onApply: (transformations: Transformations) => void;
  onCancel: () => void;
  onRetryNetwork: () => void;
}): EditorState {
  return {
    '*originalUrl': null,
    '*loadingOperations': new Map() as LoadingOperations,
    '*faderEl': null,
    '*cropperEl': null,
    '*sliderEl': null,
    '*imgEl': null,
    '*imgContainerEl': null,
    '*networkProblems': false,
    '*imageSize': null,
    '*editorTransformations': {},
    '*cropPresetList': [],
    '*currentAspectRatio': null,
    '*tabList': [...ALL_TABS],
    '*tabId': TabId.CROP,
    '*showSlider': false,
    '*showListAspectRatio': false,
    '*currentFilter': '',
    '*currentOperation': null,
    '*operationTooltip': null,
    '*padding': CROP_PADDING,
    '*operations': { rotate: 0, mirror: false, flip: false },
    '*imageBox': { x: 0, y: 0, width: 0, height: 0 },
    '*cropBox': { x: 0, y: 0, width: 0, height: 0 },
    '*on.apply': callbacks.onApply,
    '*on.cancel': callbacks.onCancel,
    '*on.retryNetwork': callbacks.onRetryNetwork,
    '*maskHref': null,
    '*testMode': false,
  };
}
